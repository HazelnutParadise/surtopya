package deid

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrNoPendingJob           = errors.New("no pending de-identification job")
	ErrNoNewResponses         = errors.New("no new responses")
	ErrSessionNotFound        = errors.New("session not found")
	ErrSessionAccessDenied    = errors.New("session access denied")
	ErrChunkIndexMismatch     = errors.New("chunk index mismatch")
	ErrSessionNotInProgress   = errors.New("session is not in progress")
	ErrReviewNotReady         = errors.New("review is not ready")
	ErrInvalidReviewOperation = errors.New("invalid review operation")
)

type Service struct {
	db           *sql.DB
	responseRepo *repository.ResponseRepository
	datasetRepo  *repository.DatasetRepository
}

func NewService(db *sql.DB) *Service {
	return &Service{
		db:           db,
		responseRepo: repository.NewResponseRepository(db),
		datasetRepo:  repository.NewDatasetRepository(db),
	}
}

type QueueResult struct {
	JobID        uuid.UUID
	Status       string
	ResponseRows int
}

type CellAnnotation struct {
	RowNo  int
	ColNo  int
	Reason string
}

type Column struct {
	ColNo int    `json:"col_no"`
	Name  string `json:"name"`
}

type Cell struct {
	ColNo int    `json:"col_no"`
	Value string `json:"value"`
}

type Row struct {
	RowNo int    `json:"row_no"`
	Cells []Cell `json:"cells"`
}

type SessionView struct {
	SessionID          uuid.UUID      `json:"session_id"`
	JobID              uuid.UUID      `json:"job_id"`
	SurveyID           uuid.UUID      `json:"survey_id"`
	Status             string         `json:"status"`
	ChunkSize          int            `json:"chunk_size"`
	CurrentChunkIndex  int            `json:"current_chunk_index"`
	TotalChunks        int            `json:"total_chunks"`
	TotalRows          int            `json:"total_rows"`
	Columns            []Column       `json:"columns"`
	Rows               []Row          `json:"rows"`
	Summary            map[string]any `json:"summary"`
	Instructions       map[string]any `json:"instructions"`
	MaskedCellsInChunk int            `json:"masked_cells_in_chunk"`
}

type ReviewDecisionInput struct {
	Action            string
	DatasetID         *uuid.UUID
	Title             string
	Description       *string
	Category          string
	AccessType        string
	Price             *int
	EntitlementPolicy string
	ReviewerID        uuid.UUID
}

type ReviewDecisionResult struct {
	JobID      uuid.UUID
	DatasetID  uuid.UUID
	Action     string
	Status     string
	DraftRows  int
	ReviewTime time.Time
}

type UsageOverview struct {
	PendingCount        int              `json:"pending_count"`
	InProgressCount     int              `json:"in_progress_count"`
	AwaitingReviewCount int              `json:"awaiting_review_count"`
	NoDataCount         int              `json:"no_data_count"`
	PendingJobs         []map[string]any `json:"pending_jobs"`
	NoDataJobs          []map[string]any `json:"no_data_jobs"`
	LatestNoDataAt      *time.Time       `json:"latest_no_data_at,omitempty"`
}

type ReviewListResult struct {
	Jobs   []map[string]any `json:"jobs"`
	Limit  int              `json:"limit"`
	Offset int              `json:"offset"`
}

type ReviewDetail struct {
	Job         map[string]any `json:"job"`
	Columns     []Column       `json:"columns"`
	PreviewRows []Row          `json:"preview_rows"`
	TotalRows   int            `json:"total_rows"`
}

type reviewJobSummary struct {
	ID                uuid.UUID      `json:"id"`
	SurveyID          uuid.UUID      `json:"survey_id"`
	SurveyTitle       string         `json:"survey_title"`
	Status            string         `json:"status"`
	TriggerSource     string         `json:"trigger_source"`
	CurrentChunkIndex int            `json:"current_chunk_index"`
	ChunkSize         int            `json:"chunk_size"`
	TotalChunks       int            `json:"total_chunks"`
	SummaryJSON       map[string]any `json:"summary_json"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	StartedAt         *time.Time     `json:"started_at,omitempty"`
	CompletedAt       *time.Time     `json:"completed_at,omitempty"`
	ReviewedAt        *time.Time     `json:"reviewed_at,omitempty"`
	ReviewedByUserID  *uuid.UUID     `json:"reviewed_by_user_id,omitempty"`
	TargetDatasetID   *uuid.UUID     `json:"target_dataset_id,omitempty"`
	NoDataReason      *string        `json:"no_data_reason,omitempty"`
}

type maskedCell struct {
	RowNo  int    `json:"row_no"`
	ColNo  int    `json:"col_no"`
	MaskID string `json:"mask_id"`
	Reason string `json:"reason,omitempty"`
}

func (s *Service) loadChunkSize(ctx context.Context) int {
	const defaultChunkSize = 50
	var raw string
	err := s.db.QueryRowContext(ctx, "SELECT value FROM system_settings WHERE key = 'deid_chunk_size'").Scan(&raw)
	if err != nil {
		return defaultChunkSize
	}
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || parsed <= 0 {
		return defaultChunkSize
	}
	return parsed
}

func (s *Service) QueueSurveyJob(ctx context.Context, surveyID uuid.UUID, triggerSource string, triggeredBy *uuid.UUID) (QueueResult, error) {
	var openJobID uuid.UUID
	var openStatus string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, status
		 FROM survey_deid_jobs
		 WHERE survey_id = $1
		   AND status IN ('pending', 'in_progress', 'awaiting_review')
		 ORDER BY created_at DESC
		 LIMIT 1`,
		surveyID,
	).Scan(&openJobID, &openStatus)
	if err == nil {
		return QueueResult{JobID: openJobID, Status: openStatus, ResponseRows: 0}, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return QueueResult{}, fmt.Errorf("failed to inspect existing deid jobs: %w", err)
	}

	chunkSize := s.loadChunkSize(ctx)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return QueueResult{}, fmt.Errorf("failed to start deid queue transaction: %w", err)
	}
	defer tx.Rollback()

	var cursor sql.NullTime
	if err := tx.QueryRowContext(
		ctx,
		`SELECT last_processed_response_created_at
		 FROM survey_deid_state
		 WHERE survey_id = $1`,
		surveyID,
	).Scan(&cursor); err != nil && err != sql.ErrNoRows {
		return QueueResult{}, fmt.Errorf("failed to load deid cursor: %w", err)
	}

	rows, err := tx.QueryContext(
		ctx,
		`SELECT id, created_at
		 FROM responses
		 WHERE survey_id = $1
		   AND status = 'completed'
		   AND ($2::timestamptz IS NULL OR created_at > $2)
		 ORDER BY created_at ASC, id ASC`,
		surveyID,
		nullableTimeArg(cursor),
	)
	if err != nil {
		return QueueResult{}, fmt.Errorf("failed to query new responses for deid: %w", err)
	}
	defer rows.Close()

	type responseRef struct {
		ID        uuid.UUID
		CreatedAt time.Time
	}
	refs := make([]responseRef, 0)
	for rows.Next() {
		var ref responseRef
		if err := rows.Scan(&ref.ID, &ref.CreatedAt); err != nil {
			return QueueResult{}, fmt.Errorf("failed to scan deid response ref: %w", err)
		}
		refs = append(refs, ref)
	}

	jobID := uuid.New()
	if len(refs) == 0 {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO survey_deid_jobs (
				id, survey_id, status, trigger_source, triggered_by_user_id, chunk_size,
				total_chunks, no_data_reason
			 ) VALUES ($1, $2, 'no_data', $3, $4, $5, 0, 'no_new_responses')`,
			jobID,
			surveyID,
			triggerSource,
			triggeredBy,
			chunkSize,
		); err != nil {
			return QueueResult{}, fmt.Errorf("failed to insert no-data deid job: %w", err)
		}

		if err := tx.Commit(); err != nil {
			return QueueResult{}, fmt.Errorf("failed to commit no-data deid job: %w", err)
		}
		return QueueResult{JobID: jobID, Status: "no_data", ResponseRows: 0}, ErrNoNewResponses
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO survey_deid_jobs (
			id, survey_id, status, trigger_source, triggered_by_user_id, chunk_size
		 ) VALUES ($1, $2, 'pending', $3, $4, $5)`,
		jobID,
		surveyID,
		triggerSource,
		triggeredBy,
		chunkSize,
	); err != nil {
		return QueueResult{}, fmt.Errorf("failed to insert pending deid job: %w", err)
	}

	for _, ref := range refs {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO survey_deid_job_rows (job_id, response_id, response_created_at)
			 VALUES ($1, $2, $3)`,
			jobID,
			ref.ID,
			ref.CreatedAt,
		); err != nil {
			return QueueResult{}, fmt.Errorf("failed to insert deid job rows: %w", err)
		}
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO survey_deid_state (survey_id, last_processed_response_created_at)
		 VALUES ($1, NULL)
		 ON CONFLICT (survey_id) DO NOTHING`,
		surveyID,
	); err != nil {
		return QueueResult{}, fmt.Errorf("failed to ensure deid state row: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return QueueResult{}, fmt.Errorf("failed to commit pending deid job: %w", err)
	}

	return QueueResult{JobID: jobID, Status: "pending", ResponseRows: len(refs)}, nil
}

func nullableTimeArg(value sql.NullTime) any {
	if !value.Valid {
		return nil
	}
	return value.Time
}

type snapshotQuestion struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	Type      string    `json:"type"`
	SortOrder int       `json:"sortOrder"`
}

type snapshotPayload struct {
	Questions []snapshotQuestion `json:"questions"`
}

func (s *Service) buildJobTable(ctx context.Context, jobID uuid.UUID) ([]string, [][]string, error) {
	var surveyID uuid.UUID
	if err := s.db.QueryRowContext(ctx, "SELECT survey_id FROM survey_deid_jobs WHERE id = $1", jobID).Scan(&surveyID); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil, ErrSessionNotFound
		}
		return nil, nil, fmt.Errorf("failed to resolve deid survey: %w", err)
	}

	jobRows, err := s.db.QueryContext(
		ctx,
		`SELECT response_id
		 FROM survey_deid_job_rows
		 WHERE job_id = $1
		 ORDER BY response_created_at ASC, response_id ASC`,
		jobID,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load deid job rows: %w", err)
	}
	defer jobRows.Close()

	rowResponseIDs := make([]uuid.UUID, 0)
	rowResponseIDSet := make(map[uuid.UUID]struct{})
	for jobRows.Next() {
		var id uuid.UUID
		if err := jobRows.Scan(&id); err != nil {
			return nil, nil, fmt.Errorf("failed to scan deid job response id: %w", err)
		}
		rowResponseIDs = append(rowResponseIDs, id)
		rowResponseIDSet[id] = struct{}{}
	}

	responses, err := s.responseRepo.GetBySurveyID(surveyID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load survey responses: %w", err)
	}

	filtered := make([]models.Response, 0, len(rowResponseIDs))
	responseMap := make(map[uuid.UUID]models.Response)
	for _, response := range responses {
		if _, ok := rowResponseIDSet[response.ID]; !ok {
			continue
		}
		if response.Status != "completed" {
			continue
		}
		responseMap[response.ID] = response
	}
	for _, id := range rowResponseIDs {
		if response, ok := responseMap[id]; ok {
			filtered = append(filtered, response)
		}
	}

	questionOrder := make([]uuid.UUID, 0)
	questionLabels := make(map[uuid.UUID]string)

	versionRows, err := s.db.QueryContext(
		ctx,
		`SELECT snapshot
		 FROM survey_versions
		 WHERE survey_id = $1
		 ORDER BY version_number ASC`,
		surveyID,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load survey versions for deid: %w", err)
	}
	defer versionRows.Close()

	for versionRows.Next() {
		var snapshot []byte
		if err := versionRows.Scan(&snapshot); err != nil {
			return nil, nil, fmt.Errorf("failed to scan survey snapshot for deid: %w", err)
		}
		if len(snapshot) == 0 {
			continue
		}

		var payload snapshotPayload
		if err := json.Unmarshal(snapshot, &payload); err != nil {
			continue
		}
		sort.SliceStable(payload.Questions, func(i, j int) bool {
			return payload.Questions[i].SortOrder < payload.Questions[j].SortOrder
		})
		for _, question := range payload.Questions {
			if question.Type == "section" {
				continue
			}
			if _, exists := questionLabels[question.ID]; exists {
				continue
			}
			label := strings.TrimSpace(question.Title)
			if label == "" {
				label = "question_" + strings.ReplaceAll(question.ID.String()[:8], "-", "")
			} else {
				label = fmt.Sprintf("%s (%s)", label, question.ID.String()[:8])
			}
			questionLabels[question.ID] = label
			questionOrder = append(questionOrder, question.ID)
		}
	}

	for _, response := range filtered {
		for _, answer := range response.Answers {
			if _, exists := questionLabels[answer.QuestionID]; exists {
				continue
			}
			questionLabels[answer.QuestionID] = "question_" + strings.ReplaceAll(answer.QuestionID.String()[:8], "-", "")
			questionOrder = append(questionOrder, answer.QuestionID)
		}
	}

	columns := []string{"response_id", "response_created_at", "response_completed_at", "survey_version_number", "respondent_ref"}
	for _, questionID := range questionOrder {
		columns = append(columns, questionLabels[questionID])
	}

	rows := make([][]string, 0, len(filtered))
	for _, response := range filtered {
		row := make([]string, len(columns))
		row[0] = response.ID.String()
		row[1] = response.CreatedAt.UTC().Format(time.RFC3339)
		if response.CompletedAt != nil {
			row[2] = response.CompletedAt.UTC().Format(time.RFC3339)
		}
		row[3] = strconv.Itoa(response.SurveyVersionNumber)
		if response.UserID != nil {
			row[4] = response.UserID.String()
		} else if response.AnonymousID != nil {
			row[4] = *response.AnonymousID
		}

		answerMap := make(map[uuid.UUID]models.Answer, len(response.Answers))
		for _, answer := range response.Answers {
			answerMap[answer.QuestionID] = answer
		}

		for idx, questionID := range questionOrder {
			answer, ok := answerMap[questionID]
			if !ok {
				continue
			}
			row[5+idx] = stringifyAnswerValue(answer.Value)
		}

		rows = append(rows, row)
	}

	return columns, rows, nil
}

func stringifyAnswerValue(value models.AnswerValue) string {
	if value.Text != nil {
		return strings.TrimSpace(*value.Text)
	}
	if value.Value != nil {
		return strings.TrimSpace(*value.Value)
	}
	if len(value.Values) > 0 {
		parts := make([]string, 0, len(value.Values))
		for _, item := range value.Values {
			trimmed := strings.TrimSpace(item)
			if trimmed != "" {
				parts = append(parts, trimmed)
			}
		}
		return strings.Join(parts, " | ")
	}
	if value.Rating != nil {
		return strconv.Itoa(*value.Rating)
	}
	if value.Date != nil {
		return strings.TrimSpace(*value.Date)
	}
	return ""
}

func chunkRows(columns []string, rows [][]string, chunkIndex int, chunkSize int) []Row {
	if chunkSize <= 0 {
		return []Row{}
	}
	start := chunkIndex * chunkSize
	if start >= len(rows) {
		return []Row{}
	}
	end := start + chunkSize
	if end > len(rows) {
		end = len(rows)
	}

	result := make([]Row, 0, end-start)
	for rowIndex := start; rowIndex < end; rowIndex++ {
		cells := make([]Cell, 0, len(columns))
		for colIndex := range columns {
			value := ""
			if colIndex < len(rows[rowIndex]) {
				value = rows[rowIndex][colIndex]
			}
			cells = append(cells, Cell{ColNo: colIndex + 1, Value: value})
		}
		result = append(result, Row{RowNo: rowIndex + 1, Cells: cells})
	}

	return result
}

func toColumnViews(columns []string) []Column {
	result := make([]Column, 0, len(columns))
	for index, name := range columns {
		result = append(result, Column{ColNo: index + 1, Name: name})
	}
	return result
}

func buildInstructions() map[string]any {
	return map[string]any{
		"how_to_use": []string{
			"Inspect each chunk in order (chunk_index starts from 0).",
			"Submit suspicious cells by row_no and col_no for masking.",
			"Each chunk advances only once; duplicate submissions are rejected.",
			"When all chunks are processed, job moves to awaiting_review.",
		},
		"masking": map[string]any{
			"token_format": "[REDACTED:m_xxxxxx]",
			"index_base":   1,
		},
	}
}

func (s *Service) StartPendingSession(ctx context.Context, ownerUserID uuid.UUID, ownerIsSuperAdmin bool) (*SessionView, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start deid session transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		SELECT j.id, j.survey_id, j.chunk_size
		FROM survey_deid_jobs j
		JOIN surveys s ON s.id = j.survey_id
		WHERE j.status = 'pending'
	`
	args := []any{}
	if !ownerIsSuperAdmin {
		query += " AND s.user_id = $1"
		args = append(args, ownerUserID)
	}
	query += " ORDER BY j.created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1"

	var jobID uuid.UUID
	var surveyID uuid.UUID
	var chunkSize int
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&jobID, &surveyID, &chunkSize); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNoPendingJob
		}
		return nil, fmt.Errorf("failed to lock pending deid job: %w", err)
	}

	columns, rows, err := s.buildJobTable(ctx, jobID)
	if err != nil {
		return nil, err
	}
	totalChunks := 0
	if len(rows) > 0 {
		totalChunks = int(math.Ceil(float64(len(rows)) / float64(chunkSize)))
	}

	columnsJSON, err := json.Marshal(columns)
	if err != nil {
		return nil, fmt.Errorf("failed to encode deid columns: %w", err)
	}
	rowsJSON, err := json.Marshal(rows)
	if err != nil {
		return nil, fmt.Errorf("failed to encode deid rows: %w", err)
	}

	now := time.Now().UTC()
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE survey_deid_jobs
		 SET status = 'in_progress',
		     started_at = COALESCE(started_at, $2),
		     chunk_size = $3,
		     total_chunks = $4,
		     current_chunk_index = 0,
		     columns_json = $5,
		     rows_json = $6,
		     updated_at = NOW()
		 WHERE id = $1`,
		jobID,
		now,
		chunkSize,
		totalChunks,
		columnsJSON,
		rowsJSON,
	); err != nil {
		return nil, fmt.Errorf("failed to initialize deid session payload: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit deid session initialization: %w", err)
	}

	return &SessionView{
		SessionID:         jobID,
		JobID:             jobID,
		SurveyID:          surveyID,
		Status:            "in_progress",
		ChunkSize:         chunkSize,
		CurrentChunkIndex: 0,
		TotalChunks:       totalChunks,
		TotalRows:         len(rows),
		Columns:           toColumnViews(columns),
		Rows:              chunkRows(columns, rows, 0, chunkSize),
		Summary: map[string]any{
			"total_rows":    len(rows),
			"total_columns": len(columns),
			"masked_cells":  0,
		},
		Instructions: buildInstructions(),
	}, nil
}

func (s *Service) GetSession(ctx context.Context, sessionID uuid.UUID, ownerUserID uuid.UUID, ownerIsSuperAdmin bool) (*SessionView, error) {
	job, err := s.getSessionJob(ctx, sessionID, ownerUserID, ownerIsSuperAdmin, false, nil)
	if err != nil {
		return nil, err
	}
	return buildSessionViewFromJob(job), nil
}

func (s *Service) AnnotateChunk(
	ctx context.Context,
	sessionID uuid.UUID,
	chunkIndex int,
	annotations []CellAnnotation,
	actorUserID *uuid.UUID,
	actorAgentID *uuid.UUID,
	ownerUserID uuid.UUID,
	ownerIsSuperAdmin bool,
) (*SessionView, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start deid annotate transaction: %w", err)
	}
	defer tx.Rollback()

	job, err := s.getSessionJob(ctx, sessionID, ownerUserID, ownerIsSuperAdmin, true, tx)
	if err != nil {
		return nil, err
	}
	if job.Status != "in_progress" {
		return nil, ErrSessionNotInProgress
	}
	if chunkIndex != job.CurrentChunkIndex {
		return nil, ErrChunkIndexMismatch
	}

	if job.ChunkSize <= 0 {
		job.ChunkSize = 50
	}
	totalRows := len(job.Rows)
	totalColumns := len(job.Columns)
	if totalRows == 0 || totalColumns == 0 {
		if _, err := tx.ExecContext(
			ctx,
			`UPDATE survey_deid_jobs
			 SET status = 'awaiting_review',
			     completed_at = NOW(),
			     updated_at = NOW()
			 WHERE id = $1`,
			job.ID,
		); err != nil {
			return nil, fmt.Errorf("failed to finalize empty deid session: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("failed to commit empty deid session finalization: %w", err)
		}
		job.Status = "awaiting_review"
		job.CurrentChunkIndex = job.TotalChunks
		return buildSessionViewFromJob(job), nil
	}

	startRow := job.CurrentChunkIndex*job.ChunkSize + 1
	endRow := startRow + job.ChunkSize - 1
	if endRow > totalRows {
		endRow = totalRows
	}

	coordSeen := make(map[string]struct{}, len(annotations))
	applied := make([]maskedCell, 0, len(annotations))
	for _, annotation := range annotations {
		if annotation.RowNo < startRow || annotation.RowNo > endRow {
			return nil, fmt.Errorf("row_no %d is out of current chunk range", annotation.RowNo)
		}
		if annotation.ColNo < 1 || annotation.ColNo > totalColumns {
			return nil, fmt.Errorf("col_no %d is out of range", annotation.ColNo)
		}
		key := fmt.Sprintf("%d:%d", annotation.RowNo, annotation.ColNo)
		if _, exists := coordSeen[key]; exists {
			continue
		}
		coordSeen[key] = struct{}{}

		rowIndex := annotation.RowNo - 1
		colIndex := annotation.ColNo - 1
		if rowIndex >= len(job.Rows) || colIndex >= len(job.Rows[rowIndex]) {
			continue
		}

		originalValue := job.Rows[rowIndex][colIndex]
		if strings.HasPrefix(originalValue, "[REDACTED:m_") {
			continue
		}

		maskID := generateMaskID()
		token := fmt.Sprintf("[REDACTED:%s]", maskID)
		job.Rows[rowIndex][colIndex] = token

		reason := strings.TrimSpace(annotation.Reason)
		applied = append(applied, maskedCell{
			RowNo:  annotation.RowNo,
			ColNo:  annotation.ColNo,
			MaskID: maskID,
			Reason: reason,
		})

		originalHash := hashCellValue(originalValue)
		var responseIDArg any
		if len(job.Rows[rowIndex]) > 0 {
			if parsedResponseID, parseErr := uuid.Parse(strings.TrimSpace(job.Rows[rowIndex][0])); parseErr == nil {
				responseIDArg = parsedResponseID
			}
		}

		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO survey_deid_mask_events (
				id, job_id, response_id, row_no, col_no, mask_id, reason,
				original_value_hash, created_by_user_id, created_by_agent_id
			 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			uuid.New(),
			job.ID,
			responseIDArg,
			annotation.RowNo,
			annotation.ColNo,
			maskID,
			nullableString(reason),
			originalHash,
			actorUserID,
			actorAgentID,
		); err != nil {
			return nil, fmt.Errorf("failed to insert deid mask event: %w", err)
		}
	}

	job.MaskedCells = append(job.MaskedCells, applied...)
	job.CurrentChunkIndex++
	job.Summary["chunks_completed"] = job.CurrentChunkIndex
	job.Summary["total_rows"] = totalRows
	job.Summary["total_columns"] = totalColumns
	job.Summary["masked_cells"] = len(job.MaskedCells)
	job.Summary["last_chunk_masked_cells"] = len(applied)

	if job.TotalChunks == 0 {
		job.TotalChunks = int(math.Ceil(float64(totalRows) / float64(job.ChunkSize)))
	}

	nextStatus := "in_progress"
	var completedAt any
	if job.CurrentChunkIndex >= job.TotalChunks {
		nextStatus = "awaiting_review"
		completedAt = time.Now().UTC()
		job.Summary["completed_at"] = completedAt
		maxCreatedAt, err := maxResponseCreatedAtForJobTx(ctx, tx, job.ID)
		if err != nil {
			return nil, err
		}
		if maxCreatedAt != nil {
			if _, err := tx.ExecContext(
				ctx,
				`INSERT INTO survey_deid_state (survey_id, last_processed_response_created_at)
				 VALUES ($1, $2)
				 ON CONFLICT (survey_id) DO UPDATE
				 SET last_processed_response_created_at = EXCLUDED.last_processed_response_created_at,
				     updated_at = NOW()`,
				job.SurveyID,
				*maxCreatedAt,
			); err != nil {
				return nil, fmt.Errorf("failed to advance deid cursor: %w", err)
			}
		}
	}

	columnsJSON, err := json.Marshal(job.Columns)
	if err != nil {
		return nil, fmt.Errorf("failed to encode deid columns: %w", err)
	}
	rowsJSON, err := json.Marshal(job.Rows)
	if err != nil {
		return nil, fmt.Errorf("failed to encode deid rows: %w", err)
	}
	maskedCellsJSON, err := json.Marshal(job.MaskedCells)
	if err != nil {
		return nil, fmt.Errorf("failed to encode deid masked cells: %w", err)
	}
	summaryJSON, err := json.Marshal(job.Summary)
	if err != nil {
		return nil, fmt.Errorf("failed to encode deid summary: %w", err)
	}

	if _, err := tx.ExecContext(
		ctx,
		`UPDATE survey_deid_jobs
		 SET status = $2,
		     current_chunk_index = $3,
		     columns_json = $4,
		     rows_json = $5,
		     masked_cells_json = $6,
		     summary_json = $7,
		     completed_at = CASE WHEN $8::timestamptz IS NULL THEN completed_at ELSE $8 END,
		     updated_at = NOW()
		 WHERE id = $1`,
		job.ID,
		nextStatus,
		job.CurrentChunkIndex,
		columnsJSON,
		rowsJSON,
		maskedCellsJSON,
		summaryJSON,
		completedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to update deid session: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit deid annotation: %w", err)
	}

	job.Status = nextStatus
	view := buildSessionViewFromJob(job)
	view.MaskedCellsInChunk = len(applied)
	return view, nil
}

type sessionJob struct {
	ID                uuid.UUID
	SurveyID          uuid.UUID
	SurveyOwnerID     uuid.UUID
	SurveyTitle       string
	Status            string
	TriggerSource     string
	CurrentChunkIndex int
	ChunkSize         int
	TotalChunks       int
	Columns           []string
	Rows              [][]string
	MaskedCells       []maskedCell
	Summary           map[string]any
	CreatedAt         time.Time
	UpdatedAt         time.Time
	StartedAt         *time.Time
	CompletedAt       *time.Time
	ReviewedAt        *time.Time
	ReviewedByUserID  *uuid.UUID
	TargetDatasetID   *uuid.UUID
	NoDataReason      *string
}

func (s *Service) GetUsageOverview(ctx context.Context, ownerUserID uuid.UUID, ownerIsSuperAdmin bool) (*UsageOverview, error) {
	overview := &UsageOverview{
		PendingJobs: make([]map[string]any, 0),
		NoDataJobs:  make([]map[string]any, 0),
	}

	condition := "1=1"
	args := []any{}
	if !ownerIsSuperAdmin {
		condition = "sv.user_id = $1"
		args = append(args, ownerUserID)
	}

	rows, err := s.db.QueryContext(
		ctx,
		fmt.Sprintf(`
			SELECT j.status, COUNT(*)
			FROM survey_deid_jobs j
			JOIN surveys sv ON sv.id = j.survey_id
			WHERE %s
			GROUP BY j.status
		`, condition),
		args...,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load deid status overview: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("failed to scan deid status overview: %w", err)
		}
		switch status {
		case "pending":
			overview.PendingCount = count
		case "in_progress":
			overview.InProgressCount = count
		case "awaiting_review":
			overview.AwaitingReviewCount = count
		case "no_data":
			overview.NoDataCount = count
		}
	}

	pendingJobs, err := s.listJobsByStatus(ctx, ownerUserID, ownerIsSuperAdmin, "pending", 10, 0)
	if err != nil {
		return nil, err
	}
	overview.PendingJobs = pendingJobs

	noDataJobs, err := s.listJobsByStatus(ctx, ownerUserID, ownerIsSuperAdmin, "no_data", 5, 0)
	if err != nil {
		return nil, err
	}
	overview.NoDataJobs = noDataJobs
	if len(noDataJobs) > 0 {
		if createdAtRaw, ok := noDataJobs[0]["created_at"].(time.Time); ok {
			createdAt := createdAtRaw
			overview.LatestNoDataAt = &createdAt
		}
	}

	return overview, nil
}

func (s *Service) ListAwaitingReviewJobs(ctx context.Context, ownerUserID uuid.UUID, ownerIsSuperAdmin bool, limit int, offset int) (*ReviewListResult, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	jobs, err := s.listJobsByStatus(ctx, ownerUserID, ownerIsSuperAdmin, "awaiting_review", limit, offset)
	if err != nil {
		return nil, err
	}

	return &ReviewListResult{
		Jobs:   jobs,
		Limit:  limit,
		Offset: offset,
	}, nil
}

func (s *Service) GetReviewDetail(ctx context.Context, jobID uuid.UUID, ownerUserID uuid.UUID, ownerIsSuperAdmin bool) (*ReviewDetail, error) {
	job, err := s.getSessionJob(ctx, jobID, ownerUserID, ownerIsSuperAdmin, false, nil)
	if err != nil {
		return nil, err
	}
	jobMap := map[string]any{
		"id":                  job.ID,
		"survey_id":           job.SurveyID,
		"survey_owner_id":     job.SurveyOwnerID,
		"survey_title":        job.SurveyTitle,
		"status":              job.Status,
		"trigger_source":      job.TriggerSource,
		"current_chunk_index": job.CurrentChunkIndex,
		"chunk_size":          job.ChunkSize,
		"total_chunks":        job.TotalChunks,
		"summary_json":        cloneMap(job.Summary),
		"created_at":          job.CreatedAt,
		"updated_at":          job.UpdatedAt,
		"started_at":          job.StartedAt,
		"completed_at":        job.CompletedAt,
		"reviewed_at":         job.ReviewedAt,
		"reviewed_by_user_id": job.ReviewedByUserID,
		"target_dataset_id":   job.TargetDatasetID,
		"no_data_reason":      job.NoDataReason,
	}

	previewCount := 20
	if len(job.Rows) < previewCount {
		previewCount = len(job.Rows)
	}
	previewRows := chunkRows(job.Columns, job.Rows, 0, previewCount)

	return &ReviewDetail{
		Job:         jobMap,
		Columns:     toColumnViews(job.Columns),
		PreviewRows: previewRows,
		TotalRows:   len(job.Rows),
	}, nil
}

func (s *Service) CompleteReview(ctx context.Context, jobID uuid.UUID, input ReviewDecisionInput) (*ReviewDecisionResult, error) {
	action := strings.TrimSpace(strings.ToLower(input.Action))
	if action != "merge" && action != "create" {
		return nil, ErrInvalidReviewOperation
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start deid review transaction: %w", err)
	}
	defer tx.Rollback()

	job, err := s.getSessionJob(ctx, jobID, input.ReviewerID, true, true, tx)
	if err != nil {
		return nil, err
	}
	if job.Status != "awaiting_review" {
		return nil, ErrReviewNotReady
	}

	var targetDataset *models.Dataset
	switch action {
	case "create":
		targetDataset, err = s.createDatasetFromReviewTx(ctx, tx, job, job.Columns, job.Rows, input)
	case "merge":
		targetDataset, err = s.mergeReviewIntoDatasetDraftTx(ctx, tx, job, job.Columns, job.Rows, input)
	}
	if err != nil {
		return nil, err
	}

	reviewedAt := time.Now().UTC()
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE survey_deid_jobs
		 SET status = 'reviewed',
		     review_action = $2,
		     target_dataset_id = $3,
		     reviewed_by_user_id = $4,
		     reviewed_at = $5,
		     updated_at = NOW()
		 WHERE id = $1`,
		job.ID,
		action,
		targetDataset.ID,
		input.ReviewerID,
		reviewedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to finalize deid review: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit deid review: %w", err)
	}

	return &ReviewDecisionResult{
		JobID:      job.ID,
		DatasetID:  targetDataset.ID,
		Action:     action,
		Status:     "reviewed",
		DraftRows:  len(job.Rows),
		ReviewTime: reviewedAt,
	}, nil
}

func (s *Service) getSessionJob(
	ctx context.Context,
	sessionID uuid.UUID,
	ownerUserID uuid.UUID,
	ownerIsSuperAdmin bool,
	forUpdate bool,
	tx *sql.Tx,
) (*sessionJob, error) {
	query := `
		SELECT
			j.id, j.survey_id, s.user_id, s.title, j.status, j.trigger_source,
			j.current_chunk_index, j.chunk_size, j.total_chunks,
			j.columns_json, j.rows_json, j.masked_cells_json, j.summary_json,
			j.created_at, j.updated_at, j.started_at, j.completed_at, j.reviewed_at,
			j.reviewed_by_user_id, j.target_dataset_id, j.no_data_reason
		FROM survey_deid_jobs j
		JOIN surveys s ON s.id = j.survey_id
		WHERE j.id = $1
	`
	if !ownerIsSuperAdmin {
		query += " AND s.user_id = $2"
	}
	if forUpdate {
		query += " FOR UPDATE"
	}

	var rowScanner interface {
		Scan(dest ...any) error
	}
	if tx != nil {
		if ownerIsSuperAdmin {
			rowScanner = tx.QueryRowContext(ctx, query, sessionID)
		} else {
			rowScanner = tx.QueryRowContext(ctx, query, sessionID, ownerUserID)
		}
	} else {
		if ownerIsSuperAdmin {
			rowScanner = s.db.QueryRowContext(ctx, query, sessionID)
		} else {
			rowScanner = s.db.QueryRowContext(ctx, query, sessionID, ownerUserID)
		}
	}

	var job sessionJob
	var columnsJSON []byte
	var rowsJSON []byte
	var maskedCellsJSON []byte
	var summaryJSON []byte
	var startedAt sql.NullTime
	var completedAt sql.NullTime
	var reviewedAt sql.NullTime
	var reviewedByUserID uuid.NullUUID
	var targetDatasetID uuid.NullUUID
	var noDataReason sql.NullString
	err := rowScanner.Scan(
		&job.ID,
		&job.SurveyID,
		&job.SurveyOwnerID,
		&job.SurveyTitle,
		&job.Status,
		&job.TriggerSource,
		&job.CurrentChunkIndex,
		&job.ChunkSize,
		&job.TotalChunks,
		&columnsJSON,
		&rowsJSON,
		&maskedCellsJSON,
		&summaryJSON,
		&job.CreatedAt,
		&job.UpdatedAt,
		&startedAt,
		&completedAt,
		&reviewedAt,
		&reviewedByUserID,
		&targetDatasetID,
		&noDataReason,
	)
	if err == sql.ErrNoRows {
		if ownerIsSuperAdmin {
			return nil, ErrSessionNotFound
		}
		return nil, ErrSessionAccessDenied
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load deid session job: %w", err)
	}

	if err := decodeJSON(columnsJSON, &job.Columns); err != nil {
		return nil, fmt.Errorf("failed to decode deid columns_json: %w", err)
	}
	if err := decodeJSON(rowsJSON, &job.Rows); err != nil {
		return nil, fmt.Errorf("failed to decode deid rows_json: %w", err)
	}
	if err := decodeJSON(maskedCellsJSON, &job.MaskedCells); err != nil {
		return nil, fmt.Errorf("failed to decode deid masked_cells_json: %w", err)
	}
	if len(summaryJSON) == 0 {
		job.Summary = map[string]any{}
	} else if err := decodeJSON(summaryJSON, &job.Summary); err != nil {
		return nil, fmt.Errorf("failed to decode deid summary_json: %w", err)
	}
	if job.Summary == nil {
		job.Summary = map[string]any{}
	}

	if startedAt.Valid {
		v := startedAt.Time
		job.StartedAt = &v
	}
	if completedAt.Valid {
		v := completedAt.Time
		job.CompletedAt = &v
	}
	if reviewedAt.Valid {
		v := reviewedAt.Time
		job.ReviewedAt = &v
	}
	if reviewedByUserID.Valid {
		v := reviewedByUserID.UUID
		job.ReviewedByUserID = &v
	}
	if targetDatasetID.Valid {
		v := targetDatasetID.UUID
		job.TargetDatasetID = &v
	}
	if noDataReason.Valid {
		v := noDataReason.String
		job.NoDataReason = &v
	}

	if !ownerIsSuperAdmin && job.SurveyOwnerID != ownerUserID {
		return nil, ErrSessionAccessDenied
	}

	if job.TotalChunks == 0 && job.ChunkSize > 0 && len(job.Rows) > 0 {
		job.TotalChunks = int(math.Ceil(float64(len(job.Rows)) / float64(job.ChunkSize)))
	}

	return &job, nil
}

func buildSessionViewFromJob(job *sessionJob) *SessionView {
	totalRows := len(job.Rows)
	totalColumns := len(job.Columns)
	maskedInCurrentChunk := 0
	if job.Status == "in_progress" && job.TotalChunks > 0 && job.CurrentChunkIndex < job.TotalChunks {
		maskedInCurrentChunk = countMaskedCellsInChunk(job.MaskedCells, job.CurrentChunkIndex, job.ChunkSize)
	}

	rows := []Row{}
	if job.Status == "in_progress" {
		rows = chunkRows(job.Columns, job.Rows, job.CurrentChunkIndex, job.ChunkSize)
	}

	summary := cloneMap(job.Summary)
	if summary == nil {
		summary = map[string]any{}
	}
	summary["total_rows"] = totalRows
	summary["total_columns"] = totalColumns
	summary["masked_cells"] = len(job.MaskedCells)
	summary["status"] = job.Status

	return &SessionView{
		SessionID:          job.ID,
		JobID:              job.ID,
		SurveyID:           job.SurveyID,
		Status:             job.Status,
		ChunkSize:          job.ChunkSize,
		CurrentChunkIndex:  job.CurrentChunkIndex,
		TotalChunks:        job.TotalChunks,
		TotalRows:          totalRows,
		Columns:            toColumnViews(job.Columns),
		Rows:               rows,
		Summary:            summary,
		Instructions:       buildInstructions(),
		MaskedCellsInChunk: maskedInCurrentChunk,
	}
}

func (s *Service) listJobsByStatus(
	ctx context.Context,
	ownerUserID uuid.UUID,
	ownerIsSuperAdmin bool,
	status string,
	limit int,
	offset int,
) ([]map[string]any, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT
			j.id,
			j.survey_id,
			s.title,
			j.status,
			j.trigger_source,
			j.current_chunk_index,
			j.chunk_size,
			j.total_chunks,
			j.summary_json,
			j.created_at,
			j.updated_at,
			j.started_at,
			j.completed_at,
			j.reviewed_at,
			j.reviewed_by_user_id,
			j.target_dataset_id,
			j.no_data_reason
		FROM survey_deid_jobs j
		JOIN surveys s ON s.id = j.survey_id
		WHERE j.status = $1
	`
	args := []any{status}
	if ownerIsSuperAdmin {
		query += " ORDER BY j.created_at DESC LIMIT $2 OFFSET $3"
		args = append(args, limit, offset)
	} else {
		query += " AND s.user_id = $2 ORDER BY j.created_at DESC LIMIT $3 OFFSET $4"
		args = append(args, ownerUserID, limit, offset)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list deid jobs by status: %w", err)
	}
	defer rows.Close()

	results := make([]map[string]any, 0)
	for rows.Next() {
		var item reviewJobSummary
		var summaryRaw []byte
		if err := rows.Scan(
			&item.ID,
			&item.SurveyID,
			&item.SurveyTitle,
			&item.Status,
			&item.TriggerSource,
			&item.CurrentChunkIndex,
			&item.ChunkSize,
			&item.TotalChunks,
			&summaryRaw,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.StartedAt,
			&item.CompletedAt,
			&item.ReviewedAt,
			&item.ReviewedByUserID,
			&item.TargetDatasetID,
			&item.NoDataReason,
		); err != nil {
			return nil, fmt.Errorf("failed to scan deid job summary: %w", err)
		}
		if len(summaryRaw) > 0 {
			_ = json.Unmarshal(summaryRaw, &item.SummaryJSON)
		}
		mapped := map[string]any{
			"id":                  item.ID,
			"survey_id":           item.SurveyID,
			"survey_title":        item.SurveyTitle,
			"status":              item.Status,
			"trigger_source":      item.TriggerSource,
			"current_chunk_index": item.CurrentChunkIndex,
			"chunk_size":          item.ChunkSize,
			"total_chunks":        item.TotalChunks,
			"summary_json":        item.SummaryJSON,
			"created_at":          item.CreatedAt,
			"updated_at":          item.UpdatedAt,
			"started_at":          item.StartedAt,
			"completed_at":        item.CompletedAt,
			"reviewed_at":         item.ReviewedAt,
			"reviewed_by_user_id": item.ReviewedByUserID,
			"target_dataset_id":   item.TargetDatasetID,
			"no_data_reason":      item.NoDataReason,
		}
		results = append(results, mapped)
	}

	return results, nil
}

func (s *Service) createDatasetFromReviewTx(
	ctx context.Context,
	tx *sql.Tx,
	job *sessionJob,
	columns []string,
	rows [][]string,
	input ReviewDecisionInput,
) (*models.Dataset, error) {
	_ = ctx
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = fmt.Sprintf("%s - De-identified", strings.TrimSpace(job.SurveyTitle))
	}
	category := strings.TrimSpace(input.Category)
	if category == "" {
		category = "other"
	}
	accessType := strings.TrimSpace(strings.ToLower(input.AccessType))
	if accessType == "" {
		accessType = "free"
	}
	if accessType != "free" && accessType != "paid" {
		return nil, fmt.Errorf("invalid access_type")
	}
	price := 0
	if input.Price != nil && *input.Price > 0 {
		price = *input.Price
	}
	if accessType == "free" {
		price = 0
	}

	entitlementPolicy := normalizeEntitlementPolicy(input.EntitlementPolicy)

	filePath, fileName, fileSize, err := writeDatasetCSVArtifact(columns, rows, uuid.Nil)
	if err != nil {
		return nil, err
	}

	datasetID := uuid.New()
	dataset := &models.Dataset{
		ID:                    datasetID,
		SurveyID:              &job.SurveyID,
		Title:                 title,
		Description:           trimStringPointer(input.Description),
		Category:              category,
		AccessType:            accessType,
		Price:                 price,
		SampleSize:            len(rows),
		IsActive:              true,
		FilePath:              filePath,
		FileName:              fileName,
		FileSize:              fileSize,
		MimeType:              "text/csv",
		HasUnpublishedChanges: true,
		EntitlementPolicy:     entitlementPolicy,
	}
	if err := s.datasetRepo.CreateWithTx(tx, dataset); err != nil {
		return nil, err
	}

	draft := &models.DatasetDraft{
		DatasetID:       dataset.ID,
		Title:           dataset.Title,
		Description:     dataset.Description,
		Category:        dataset.Category,
		AccessType:      dataset.AccessType,
		Price:           dataset.Price,
		SampleSize:      dataset.SampleSize,
		FilePath:        dataset.FilePath,
		FileName:        dataset.FileName,
		FileSize:        dataset.FileSize,
		MimeType:        dataset.MimeType,
		SourceDeidJobID: &job.ID,
		UpdatedBy:       &input.ReviewerID,
	}
	if err := s.datasetRepo.UpsertDraftTx(tx, draft); err != nil {
		return nil, err
	}

	return dataset, nil
}

func (s *Service) mergeReviewIntoDatasetDraftTx(
	ctx context.Context,
	tx *sql.Tx,
	job *sessionJob,
	columns []string,
	rows [][]string,
	input ReviewDecisionInput,
) (*models.Dataset, error) {
	_ = ctx
	if input.DatasetID == nil {
		return nil, fmt.Errorf("dataset_id is required for merge")
	}

	dataset, err := s.datasetRepo.GetByID(*input.DatasetID)
	if err != nil {
		return nil, err
	}
	if dataset == nil {
		return nil, fmt.Errorf("target dataset not found")
	}

	draft, err := s.datasetRepo.GetDraft(dataset.ID)
	if err != nil {
		return nil, err
	}
	if draft == nil {
		if err := s.datasetRepo.CopyDatasetAsDraftTx(tx, dataset.ID, &input.ReviewerID); err != nil {
			return nil, err
		}
		draft, err = s.datasetRepo.GetDraft(dataset.ID)
		if err != nil {
			return nil, err
		}
		if draft == nil {
			return nil, fmt.Errorf("failed to initialize dataset draft")
		}
	}

	mergedColumns, mergedRows, err := mergeWithExistingDraft(draft.FilePath, columns, rows)
	if err != nil {
		return nil, err
	}
	filePath, fileName, fileSize, err := writeDatasetCSVArtifact(mergedColumns, mergedRows, dataset.ID)
	if err != nil {
		return nil, err
	}

	updatedDraft := &models.DatasetDraft{
		DatasetID:       draft.DatasetID,
		Title:           draft.Title,
		Description:     draft.Description,
		Category:        draft.Category,
		AccessType:      draft.AccessType,
		Price:           draft.Price,
		SampleSize:      len(mergedRows),
		FilePath:        filePath,
		FileName:        fileName,
		FileSize:        fileSize,
		MimeType:        "text/csv",
		SourceDeidJobID: &job.ID,
		UpdatedBy:       &input.ReviewerID,
	}
	if err := s.datasetRepo.UpsertDraftTx(tx, updatedDraft); err != nil {
		return nil, err
	}

	if err := s.datasetRepo.MarkDatasetHasUnpublishedChangesTx(tx, dataset.ID, true); err != nil {
		return nil, err
	}

	return dataset, nil
}

func mergeWithExistingDraft(existingPath string, newColumns []string, newRows [][]string) ([]string, [][]string, error) {
	existingColumns, existingRows, err := readCSVArtifact(existingPath)
	if err != nil {
		return nil, nil, err
	}
	if len(existingColumns) == 0 {
		return newColumns, newRows, nil
	}

	unionColumns := make([]string, 0, len(existingColumns)+len(newColumns))
	seen := make(map[string]struct{}, len(existingColumns)+len(newColumns))
	appendColumn := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" {
			return
		}
		if _, exists := seen[name]; exists {
			return
		}
		seen[name] = struct{}{}
		unionColumns = append(unionColumns, name)
	}
	for _, col := range existingColumns {
		appendColumn(col)
	}
	for _, col := range newColumns {
		appendColumn(col)
	}

	existingIndex := make(map[string]int, len(existingColumns))
	for index, col := range existingColumns {
		existingIndex[col] = index
	}
	newIndex := make(map[string]int, len(newColumns))
	for index, col := range newColumns {
		newIndex[col] = index
	}

	mergedRows := make([][]string, 0, len(existingRows)+len(newRows))
	for _, row := range existingRows {
		out := make([]string, len(unionColumns))
		for unionIndex, col := range unionColumns {
			if sourceIndex, ok := existingIndex[col]; ok && sourceIndex < len(row) {
				out[unionIndex] = row[sourceIndex]
			}
		}
		mergedRows = append(mergedRows, out)
	}
	for _, row := range newRows {
		out := make([]string, len(unionColumns))
		for unionIndex, col := range unionColumns {
			if sourceIndex, ok := newIndex[col]; ok && sourceIndex < len(row) {
				out[unionIndex] = row[sourceIndex]
			}
		}
		mergedRows = append(mergedRows, out)
	}

	return unionColumns, mergedRows, nil
}

func writeDatasetCSVArtifact(columns []string, rows [][]string, datasetID uuid.UUID) (string, string, int64, error) {
	dataDir := strings.TrimSpace(os.Getenv("DATASETS_DIR"))
	if dataDir == "" {
		dataDir = "/data/datasets"
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return "", "", 0, fmt.Errorf("failed to prepare dataset artifact directory: %w", err)
	}

	base := "dataset"
	if datasetID != uuid.Nil {
		base = datasetID.String()
	}
	fileName := fmt.Sprintf("%s-draft-%d.csv", base, time.Now().UTC().UnixNano())
	targetPath := filepath.Join(dataDir, fileName)

	file, err := os.Create(targetPath)
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to create dataset artifact: %w", err)
	}
	writer := csv.NewWriter(file)
	if err := writer.Write(columns); err != nil {
		_ = file.Close()
		return "", "", 0, fmt.Errorf("failed to write dataset artifact header: %w", err)
	}
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			_ = file.Close()
			return "", "", 0, fmt.Errorf("failed to write dataset artifact row: %w", err)
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		_ = file.Close()
		return "", "", 0, fmt.Errorf("failed to flush dataset artifact: %w", err)
	}
	if err := file.Close(); err != nil {
		return "", "", 0, fmt.Errorf("failed to close dataset artifact: %w", err)
	}

	info, err := os.Stat(targetPath)
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to stat dataset artifact: %w", err)
	}
	return targetPath, fileName, info.Size(), nil
}

func readCSVArtifact(path string) ([]string, [][]string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, nil, nil
	}
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, nil
		}
		return nil, nil, fmt.Errorf("failed to open csv artifact: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read csv artifact: %w", err)
	}
	if len(records) == 0 {
		return nil, nil, nil
	}
	header := records[0]
	body := make([][]string, 0, len(records)-1)
	for _, record := range records[1:] {
		body = append(body, record)
	}
	return header, body, nil
}

func maxResponseCreatedAtForJobTx(ctx context.Context, tx *sql.Tx, jobID uuid.UUID) (*time.Time, error) {
	var maxCreatedAt sql.NullTime
	if err := tx.QueryRowContext(
		ctx,
		`SELECT MAX(response_created_at)
		 FROM survey_deid_job_rows
		 WHERE job_id = $1`,
		jobID,
	).Scan(&maxCreatedAt); err != nil {
		return nil, fmt.Errorf("failed to read max response_created_at for deid job: %w", err)
	}
	if !maxCreatedAt.Valid {
		return nil, nil
	}
	value := maxCreatedAt.Time
	return &value, nil
}

func hashCellValue(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func generateMaskID() string {
	raw := strings.ReplaceAll(uuid.New().String(), "-", "")
	if len(raw) < 8 {
		return "m_" + raw
	}
	return "m_" + raw[:8]
}

func decodeJSON[T any](raw []byte, out *T) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}

func countMaskedCellsInChunk(masked []maskedCell, chunkIndex int, chunkSize int) int {
	if chunkSize <= 0 {
		return 0
	}
	start := chunkIndex*chunkSize + 1
	end := start + chunkSize - 1
	count := 0
	for _, item := range masked {
		if item.RowNo >= start && item.RowNo <= end {
			count++
		}
	}
	return count
}

func cloneMap(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}
	out := make(map[string]any, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func nullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func trimStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeEntitlementPolicy(raw string) string {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "all_versions_if_any_purchase":
		return "all_versions_if_any_purchase"
	default:
		return "purchased_only"
	}
}
