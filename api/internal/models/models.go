package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID             uuid.UUID `json:"id" db:"id"`
	LogtoUserID    string    `json:"logtoUserId" db:"logto_user_id"`
	Email          *string   `json:"email,omitempty" db:"email"`
	DisplayName    *string   `json:"displayName,omitempty" db:"display_name"`
	AvatarURL      *string   `json:"avatarUrl,omitempty" db:"avatar_url"`
	Phone          *string   `json:"phone,omitempty" db:"phone"`
	Bio            *string   `json:"bio,omitempty" db:"bio"`
	Location       *string   `json:"location,omitempty" db:"location"`
	PointsBalance  int       `json:"pointsBalance" db:"points_balance"`
	MembershipTier string    `json:"membershipTier,omitempty"`
	IsAdmin        bool      `json:"isAdmin" db:"is_admin"`
	IsSuperAdmin   bool      `json:"isSuperAdmin" db:"is_super_admin"`
	Locale         string    `json:"locale" db:"locale"`
	TimeZone       string    `json:"timeZone" db:"timezone"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time `json:"updatedAt" db:"updated_at"`
}

// SurveyTheme represents the visual theme of a survey
type SurveyTheme struct {
	PrimaryColor    string `json:"primaryColor"`
	BackgroundColor string `json:"backgroundColor"`
	FontFamily      string `json:"fontFamily"`
}

// Survey represents a survey
type Survey struct {
	ID                            uuid.UUID    `json:"id" db:"id"`
	UserID                        uuid.UUID    `json:"userId" db:"user_id"`
	Title                         string       `json:"title" db:"title"`
	Description                   string       `json:"description" db:"description"`
	Visibility                    string       `json:"visibility" db:"visibility"`
	RequireLoginToRespond         bool         `json:"requireLoginToRespond" db:"require_login_to_respond"`
	IsResponseOpen                bool         `json:"isResponseOpen" db:"is_response_open"`
	IncludeInDatasets             bool         `json:"includeInDatasets" db:"include_in_datasets"`
	EverPublic                    bool         `json:"everPublic" db:"ever_public"`
	PublishedCount                int          `json:"publishedCount" db:"published_count"`
	HasUnpublishedChanges         bool         `json:"hasUnpublishedChanges" db:"has_unpublished_changes"`
	CurrentPublishedVersionID     *uuid.UUID   `json:"currentPublishedVersionId,omitempty" db:"current_published_version_id"`
	CurrentPublishedVersionNumber *int         `json:"currentPublishedVersionNumber,omitempty" db:"current_published_version_number"`
	Theme                         *SurveyTheme `json:"theme,omitempty" db:"theme"`
	PointsReward                  int          `json:"pointsReward" db:"points_reward"`
	ExpiresAt                     *time.Time   `json:"expiresAt,omitempty" db:"expires_at"`
	ResponseCount                 int          `json:"responseCount" db:"response_count"`
	IsHot                         bool         `json:"isHot" db:"is_hot"`
	HasResponded                  bool         `json:"hasResponded" db:"-"`
	DeletedAt                     *time.Time   `json:"deletedAt,omitempty" db:"deleted_at"`
	CreatedAt                     time.Time    `json:"createdAt" db:"created_at"`
	UpdatedAt                     time.Time    `json:"updatedAt" db:"updated_at"`
	PublishedAt                   *time.Time   `json:"publishedAt,omitempty" db:"published_at"`
	Questions                     []Question   `json:"questions,omitempty"`
}

// LogicRule represents conditional logic for a question
type LogicRule struct {
	TriggerOption         string `json:"triggerOption"`
	DestinationQuestionID string `json:"destinationQuestionId"`
}

// Question represents a question in a survey
type Question struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	SurveyID    uuid.UUID   `json:"surveyId" db:"survey_id"`
	Type        string      `json:"type" db:"type"`
	Title       string      `json:"title" db:"title"`
	Description *string     `json:"description,omitempty" db:"description"`
	Options     []string    `json:"options,omitempty" db:"options"`
	Required    bool        `json:"required" db:"required"`
	MaxRating   int         `json:"maxRating,omitempty" db:"max_rating"`
	Logic       []LogicRule `json:"logic,omitempty" db:"logic"`
	SortOrder   int         `json:"sortOrder" db:"sort_order"`
	CreatedAt   time.Time   `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time   `json:"updatedAt" db:"updated_at"`
}

// Response represents a survey response
type Response struct {
	ID                  uuid.UUID  `json:"id" db:"id"`
	SurveyID            uuid.UUID  `json:"surveyId" db:"survey_id"`
	SurveyVersionID     uuid.UUID  `json:"surveyVersionId" db:"survey_version_id"`
	SurveyVersionNumber int        `json:"surveyVersionNumber" db:"survey_version_number"`
	UserID              *uuid.UUID `json:"userId,omitempty" db:"user_id"`
	AnonymousID         *string    `json:"anonymousId,omitempty" db:"anonymous_id"`
	Status              string     `json:"status" db:"status"`
	PointsAwarded       int        `json:"pointsAwarded" db:"points_awarded"`
	StartedAt           time.Time  `json:"startedAt" db:"started_at"`
	CompletedAt         *time.Time `json:"completedAt,omitempty" db:"completed_at"`
	CreatedAt           time.Time  `json:"createdAt" db:"created_at"`
	Answers             []Answer   `json:"answers,omitempty"`
}

// ResponseDraft represents an authenticated in-progress survey draft.
type ResponseDraft struct {
	ID                  uuid.UUID             `json:"id" db:"id"`
	SurveyID            uuid.UUID             `json:"surveyId" db:"survey_id"`
	SurveyVersionID     uuid.UUID             `json:"surveyVersionId" db:"survey_version_id"`
	SurveyVersionNumber int                   `json:"surveyVersionNumber" db:"survey_version_number"`
	UserID              uuid.UUID             `json:"userId" db:"user_id"`
	StartedAt           time.Time             `json:"startedAt" db:"started_at"`
	UpdatedAt           time.Time             `json:"updatedAt" db:"updated_at"`
	CreatedAt           time.Time             `json:"createdAt" db:"created_at"`
	Answers             []ResponseDraftAnswer `json:"answers,omitempty"`
}

// ResponseDraftAnswer represents a single answer inside an authenticated draft.
type ResponseDraftAnswer struct {
	ID         uuid.UUID   `json:"id" db:"id"`
	DraftID    uuid.UUID   `json:"draftId" db:"draft_id"`
	QuestionID uuid.UUID   `json:"questionId" db:"question_id"`
	Value      AnswerValue `json:"value" db:"value"`
	CreatedAt  time.Time   `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time   `json:"updatedAt" db:"updated_at"`
}

// ResponseDraftSummary is the lightweight dashboard payload for in-progress drafts.
type ResponseDraftSummary struct {
	ID                  uuid.UUID `json:"id"`
	SurveyID            uuid.UUID `json:"surveyId"`
	SurveyTitle         string    `json:"surveyTitle"`
	SurveyVersionID     uuid.UUID `json:"surveyVersionId"`
	SurveyVersionNumber int       `json:"surveyVersionNumber"`
	StartedAt           time.Time `json:"startedAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
	CanResume           bool      `json:"canResume"`
}

// SurveyVersion represents an immutable published survey version.
type SurveyVersion struct {
	ID            uuid.UUID       `json:"id" db:"id"`
	SurveyID      uuid.UUID       `json:"surveyId" db:"survey_id"`
	VersionNumber int             `json:"versionNumber" db:"version_number"`
	Snapshot      json.RawMessage `json:"snapshot" db:"snapshot"`
	PointsReward  int             `json:"pointsReward" db:"points_reward"`
	ExpiresAt     *time.Time      `json:"expiresAt,omitempty" db:"expires_at"`
	PublishedAt   time.Time       `json:"publishedAt" db:"published_at"`
	PublishedBy   *uuid.UUID      `json:"publishedBy,omitempty" db:"published_by"`
	CreatedAt     time.Time       `json:"createdAt" db:"created_at"`
}

// AnswerValue is a flexible container for different answer types
type AnswerValue struct {
	Value  *string  `json:"value,omitempty"`  // For single/select
	Values []string `json:"values,omitempty"` // For multi
	Text   *string  `json:"text,omitempty"`   // For text/short/long
	Rating *int     `json:"rating,omitempty"` // For rating
	Date   *string  `json:"date,omitempty"`   // For date
}

// Answer represents an answer to a question
type Answer struct {
	ID         uuid.UUID   `json:"id" db:"id"`
	ResponseID uuid.UUID   `json:"responseId" db:"response_id"`
	QuestionID uuid.UUID   `json:"questionId" db:"question_id"`
	Value      AnswerValue `json:"value" db:"value"`
	CreatedAt  time.Time   `json:"createdAt" db:"created_at"`
}

// Dataset represents a dataset in the marketplace
type Dataset struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	SurveyID      *uuid.UUID `json:"surveyId,omitempty" db:"survey_id"`
	Title         string     `json:"title" db:"title"`
	Description   *string    `json:"description,omitempty" db:"description"`
	Category      string     `json:"category" db:"category"`
	AccessType    string     `json:"accessType" db:"access_type"`
	Price         int        `json:"price" db:"price"`
	DownloadCount int        `json:"downloadCount" db:"download_count"`
	SampleSize    int        `json:"sampleSize" db:"sample_size"`
	IsActive      bool       `json:"isActive" db:"is_active"`
	FilePath      string     `json:"-" db:"file_path"`
	FileName      string     `json:"fileName,omitempty" db:"file_name"`
	FileSize      int64      `json:"fileSize,omitempty" db:"file_size"`
	MimeType      string     `json:"mimeType,omitempty" db:"mime_type"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time  `json:"updatedAt" db:"updated_at"`
}

// PointsTransaction represents a points transaction
type PointsTransaction struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      uuid.UUID  `json:"userId" db:"user_id"`
	Amount      int        `json:"amount" db:"amount"`
	Type        string     `json:"type" db:"type"`
	Description *string    `json:"description,omitempty" db:"description"`
	SurveyID    *uuid.UUID `json:"surveyId,omitempty" db:"survey_id"`
	DatasetID   *uuid.UUID `json:"datasetId,omitempty" db:"dataset_id"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
}

// Valid question types
var ValidQuestionTypes = []string{
	"single", "multi", "text", "short", "long", "rating", "date", "select", "section",
}

// Valid visibility options
var ValidVisibilityOptions = []string{"public", "non-public"}

// Valid response statuses
var ValidResponseStatuses = []string{"completed", "abandoned"}

// Valid access types
var ValidAccessTypes = []string{"free", "paid"}

// Valid transaction types
var ValidTransactionTypes = []string{
	"survey_reward", "dataset_purchase", "dataset_sale", "admin_grant", "referral", "pro_monthly_grant", "survey_boost_spend",
}
