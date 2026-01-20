package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID            uuid.UUID `json:"id" db:"id"`
	LogtoUserID   string    `json:"logtoUserId" db:"logto_user_id"`
	Email         *string   `json:"email,omitempty" db:"email"`
	DisplayName   *string   `json:"displayName,omitempty" db:"display_name"`
	AvatarURL     *string   `json:"avatarUrl,omitempty" db:"avatar_url"`
	PointsBalance int       `json:"pointsBalance" db:"points_balance"`
	IsPro         bool      `json:"isPro" db:"is_pro"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
}

// SurveyTheme represents the visual theme of a survey
type SurveyTheme struct {
	PrimaryColor    string `json:"primaryColor"`
	BackgroundColor string `json:"backgroundColor"`
	FontFamily      string `json:"fontFamily"`
}

// Survey represents a survey
type Survey struct {
	ID                uuid.UUID    `json:"id" db:"id"`
	UserID            uuid.UUID    `json:"userId" db:"user_id"`
	Title             string       `json:"title" db:"title"`
	Description       string       `json:"description" db:"description"`
	Visibility        string       `json:"visibility" db:"visibility"`
	IsPublished       bool         `json:"isPublished" db:"is_published"`
	IncludeInDatasets bool         `json:"includeInDatasets" db:"include_in_datasets"`
	PublishedCount    int          `json:"publishedCount" db:"published_count"`
	Theme             *SurveyTheme `json:"theme,omitempty" db:"theme"`
	PointsReward      int          `json:"pointsReward" db:"points_reward"`
	ExpiresAt         *time.Time   `json:"expiresAt,omitempty" db:"expires_at"`
	ResponseCount     int          `json:"responseCount" db:"response_count"`
	CreatedAt         time.Time    `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time    `json:"updatedAt" db:"updated_at"`
	PublishedAt       *time.Time   `json:"publishedAt,omitempty" db:"published_at"`
	Questions         []Question   `json:"questions,omitempty"`
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
	Points      int         `json:"points" db:"points"`
	MaxRating   int         `json:"maxRating,omitempty" db:"max_rating"`
	Logic       []LogicRule `json:"logic,omitempty" db:"logic"`
	SortOrder   int         `json:"sortOrder" db:"sort_order"`
	CreatedAt   time.Time   `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time   `json:"updatedAt" db:"updated_at"`
}

// Response represents a survey response
type Response struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	SurveyID      uuid.UUID  `json:"surveyId" db:"survey_id"`
	UserID        *uuid.UUID `json:"userId,omitempty" db:"user_id"`
	AnonymousID   *string    `json:"anonymousId,omitempty" db:"anonymous_id"`
	Status        string     `json:"status" db:"status"`
	PointsAwarded int        `json:"pointsAwarded" db:"points_awarded"`
	StartedAt     time.Time  `json:"startedAt" db:"started_at"`
	CompletedAt   *time.Time `json:"completedAt,omitempty" db:"completed_at"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
	Answers       []Answer   `json:"answers,omitempty"`
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
	ID            uuid.UUID `json:"id" db:"id"`
	SurveyID      uuid.UUID `json:"surveyId" db:"survey_id"`
	Title         string    `json:"title" db:"title"`
	Description   *string   `json:"description,omitempty" db:"description"`
	Category      string    `json:"category" db:"category"`
	AccessType    string    `json:"accessType" db:"access_type"`
	Price         int       `json:"price" db:"price"`
	DownloadCount int       `json:"downloadCount" db:"download_count"`
	SampleSize    int       `json:"sampleSize" db:"sample_size"`
	IsActive      bool      `json:"isActive" db:"is_active"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
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
var ValidResponseStatuses = []string{"in_progress", "completed", "abandoned"}

// Valid access types
var ValidAccessTypes = []string{"free", "paid"}

// Valid transaction types
var ValidTransactionTypes = []string{
	"survey_reward", "dataset_purchase", "dataset_sale", "admin_grant", "referral",
}
