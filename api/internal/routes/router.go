package routes

import (
	"github.com/TimLai666/surtopya-api/internal/handlers"
	"github.com/TimLai666/surtopya-api/internal/middleware"
	"github.com/gin-gonic/gin"
)

type setupOptions struct {
	includeInternalApp bool
}

// SetupRouter configures the full internal API routes.
func SetupRouter() *gin.Engine {
	return setupRouter(setupOptions{
		includeInternalApp: true,
	})
}

// SetupPublicRouter configures the externally exposed API routes.
func SetupPublicRouter() *gin.Engine {
	return setupRouter(setupOptions{
		includeInternalApp: false,
	})
}

func setupRouter(options setupOptions) *gin.Engine {
	r := gin.Default()

	// Add CORS middleware
	r.Use(middleware.CORSMiddleware())

	// Correlation id + structured request logging
	r.Use(middleware.RequestLoggingMiddleware())

	// Guard v1 APIs that require an available database.
	r.Use(middleware.RequireDBReady())

	// Add auth middleware (processes token but doesn't require it)
	r.Use(middleware.AuthMiddleware())

	responseHandler := handlers.NewResponseHandler()
	surveyHandler := handlers.NewSurveyHandler()
	datasetHandler := handlers.NewDatasetHandler()
	agentAdminHandler := handlers.NewAgentAdminHandler()
	adminHandler := handlers.NewAdminHandler()
	userSettingsHandler := handlers.NewUserSettingsHandler()
	userHandler := handlers.NewUserHandler()

	// App-internal routes for frontend/BFF.
	if options.includeInternalApp {
		api := r.Group("/api")
		app := api.Group("/app", middleware.RequireInternalApp())
		{
			surveys := app.Group("/surveys")
			{
				// Public survey endpoints still require app-internal signature.
				surveys.GET("/public", surveyHandler.GetPublicSurveys)
				surveys.GET("/:id", surveyHandler.GetSurvey)

				// Authenticated endpoints.
				surveys.POST("", middleware.RequireAuth(), surveyHandler.CreateSurvey)
				surveys.GET("/my", middleware.RequireAuth(), surveyHandler.GetMySurveys)
				surveys.PUT("/:id", middleware.RequireAuth(), surveyHandler.UpdateSurvey)
				surveys.DELETE("/:id", middleware.RequireAuth(), surveyHandler.DeleteSurvey)
				surveys.POST("/:id/publish", middleware.RequireAuth(), surveyHandler.PublishSurvey)
				surveys.POST("/:id/responses/open", middleware.RequireAuth(), surveyHandler.OpenSurveyResponses)
				surveys.POST("/:id/responses/close", middleware.RequireAuth(), surveyHandler.CloseSurveyResponses)
				surveys.GET("/:id/versions", middleware.RequireAuth(), surveyHandler.ListSurveyVersions)
				surveys.GET("/:id/versions/:versionNumber", middleware.RequireAuth(), surveyHandler.GetSurveyVersion)
				surveys.POST("/:id/versions/:versionNumber/restore-draft", middleware.RequireAuth(), surveyHandler.RestoreSurveyVersionDraft)
			}

			appResponses := app.Group("/responses")
			{
				appResponses.GET("/my", middleware.RequireAuth(), responseHandler.GetMyCompletedResponses)
				appResponses.GET("/:id", responseHandler.GetResponse)
				appResponses.POST("/:id/answers", responseHandler.SubmitAnswer)
				appResponses.POST("/:id/submit", responseHandler.SubmitAllAnswers)
				appResponses.POST("/claim-anonymous-points", middleware.RequireAuth(), responseHandler.ClaimAnonymousPoints)
				appResponses.POST("/forfeit-anonymous-points", responseHandler.ForfeitAnonymousPoints)
			}

			app.GET("/surveys/:id/responses", middleware.RequireAuth(), responseHandler.GetSurveyResponses)
			app.GET("/surveys/:id/responses/analytics", middleware.RequireAuth(), responseHandler.GetSurveyResponseAnalytics)
			app.POST("/surveys/:id/responses/start", responseHandler.StartResponse)
			app.POST("/surveys/:id/responses/submit-anonymous", responseHandler.SubmitAnonymousResponse)
			app.POST("/surveys/:id/drafts/start", middleware.RequireAuth(), responseHandler.StartDraft)

			appDrafts := app.Group("/drafts", middleware.RequireAuth())
			{
				appDrafts.GET("/my", responseHandler.GetMyDrafts)
				appDrafts.POST("/:id/answers", responseHandler.SaveDraftAnswer)
				appDrafts.POST("/:id/answers/bulk", responseHandler.SaveDraftAnswersBulk)
				appDrafts.POST("/:id/submit", responseHandler.SubmitDraft)
			}

			app.GET("/bootstrap", adminHandler.GetBootstrapStatus)
			app.GET("/config", adminHandler.GetPublicConfig)
			app.GET("/pricing/plans", adminHandler.GetPricingPlans)

			me := app.Group("/me", middleware.RequireAuth())
			{
				me.GET("", userHandler.GetProfile)
				me.PATCH("", userHandler.UpdateProfile)
				me.GET("/settings", userSettingsHandler.GetSettings)
				me.PATCH("/settings", userSettingsHandler.UpdateSettings)
			}

			admin := app.Group("/admin", middleware.RequireAuth(), middleware.RequireAdmin())
			{
				admin.GET("/surveys", adminHandler.GetSurveys)
				admin.PATCH("/surveys/:id", adminHandler.UpdateSurvey)
				admin.POST("/surveys/:id/publish", adminHandler.PublishSurveyVersion)
				admin.POST("/surveys/:id/responses/open", adminHandler.OpenSurveyResponses)
				admin.POST("/surveys/:id/responses/close", adminHandler.CloseSurveyResponses)
				admin.GET("/surveys/:id/versions", adminHandler.ListSurveyVersions)
				admin.GET("/surveys/:id/versions/:versionNumber", adminHandler.GetSurveyVersion)
				admin.POST("/surveys/:id/versions/:versionNumber/restore-draft", adminHandler.RestoreSurveyVersionDraft)
				admin.DELETE("/surveys/:id", adminHandler.DeleteSurvey)
				admin.GET("/datasets", adminHandler.GetDatasets)
				admin.POST("/datasets", adminHandler.CreateDataset)
				admin.GET("/datasets/:id/versions", adminHandler.ListDatasetVersions)
				admin.POST("/datasets/:id/publish", adminHandler.PublishDatasetVersion)
				admin.PATCH("/datasets/:id", adminHandler.UpdateDataset)
				admin.DELETE("/datasets/:id", adminHandler.DeleteDataset)
				admin.GET("/deid/reviews", adminHandler.ListDeidReviewJobs)
				admin.GET("/deid/reviews/:jobId", adminHandler.GetDeidReviewJob)
				admin.POST("/deid/reviews/:jobId/complete", adminHandler.CompleteDeidReview)
				admin.GET("/users", adminHandler.GetUsers)
				admin.POST("/users/points-adjust", adminHandler.AdjustUsersPoints)
				admin.PATCH("/users/:id", adminHandler.UpdateUser)
				admin.GET("/subscription-plans", adminHandler.GetSubscriptionPlans)
				admin.POST("/subscription-plans", adminHandler.CreateSubscriptionPlan)
				admin.PATCH("/subscription-plans/:id", adminHandler.UpdateSubscriptionPlan)
				admin.DELETE("/subscription-plans/:id", adminHandler.DeactivateSubscriptionPlan)
				admin.GET("/policies", adminHandler.GetPolicies)
				admin.PATCH("/policies", adminHandler.UpdatePolicies)
				admin.PATCH("/capabilities/:id", adminHandler.UpdateCapability)
				admin.GET("/policy-writers", adminHandler.GetPolicyWriters)
				admin.PUT("/policy-writers/:id", adminHandler.UpdatePolicyWriter)
				admin.GET("/system-settings", adminHandler.GetSystemSettings)
				admin.PATCH("/system-settings", adminHandler.UpdateSystemSettings)
				admin.GET("/agents", agentAdminHandler.ListAccounts)
				admin.POST("/agents", agentAdminHandler.CreateAccount)
				admin.GET("/agents/:id", agentAdminHandler.GetAccount)
				admin.PATCH("/agents/:id", agentAdminHandler.UpdateAccount)
				admin.POST("/agents/:id/reveal-key", agentAdminHandler.RevealKey)
				admin.POST("/agents/:id/rotate-key", agentAdminHandler.RotateKey)
			}

			app.POST("/ui-events", agentAdminHandler.IngestUIEvent)
		}
	}

	v1 := r.Group("/v1")
	{
		// Health check
		v1.GET("/health", handlers.HealthHandler)
		v1.GET("/ready", handlers.ReadyHandler)

		// Dataset routes
		datasets := v1.Group("/datasets")
		{
			datasets.GET("", datasetHandler.GetDatasets)
			datasets.GET("/categories", datasetHandler.GetCategories)
			datasets.GET("/:id", datasetHandler.GetDataset)
			datasets.GET("/:id/versions", datasetHandler.ListDatasetVersions)
			datasets.POST("/:id/purchase", datasetHandler.PurchaseDataset)
			datasets.POST("/:id/download", datasetHandler.DownloadDataset)
		}

		agentDocs := v1.Group("/agent-admin")
		{
			agentDocs.GET("", agentAdminHandler.GetUsageIndex)
			agentDocs.GET("/openapi.json", agentAdminHandler.GetOpenAPI)
		}

		agentProtected := v1.Group("/agent-admin", middleware.RequireAgentAdmin())
		{
			agentProtected.GET("/me", agentAdminHandler.GetMe)
			agentProtected.GET("/logs", middleware.RequireAgentPermission("logs.read"), agentAdminHandler.ListLogs)
			agentProtected.GET("/logs/:id", middleware.RequireAgentPermission("logs.read"), agentAdminHandler.GetLog)
			agentProtected.GET("/surveys", middleware.RequireAgentPermission("surveys.read"), adminHandler.GetSurveys)
			agentProtected.PATCH("/surveys/:id", middleware.RequireAgentPermission("surveys.write"), adminHandler.UpdateSurvey)
			agentProtected.POST("/surveys/:id/publish", middleware.RequireAgentPermission("surveys.write"), adminHandler.PublishSurveyVersion)
			agentProtected.POST("/surveys/:id/responses/open", middleware.RequireAgentPermission("surveys.write"), adminHandler.OpenSurveyResponses)
			agentProtected.POST("/surveys/:id/responses/close", middleware.RequireAgentPermission("surveys.write"), adminHandler.CloseSurveyResponses)
			agentProtected.GET("/surveys/:id/versions", middleware.RequireAgentPermission("surveys.read"), adminHandler.ListSurveyVersions)
			agentProtected.GET("/surveys/:id/versions/:versionNumber", middleware.RequireAgentPermission("surveys.read"), adminHandler.GetSurveyVersion)
			agentProtected.POST("/surveys/:id/versions/:versionNumber/restore-draft", middleware.RequireAgentPermission("surveys.write"), adminHandler.RestoreSurveyVersionDraft)
			agentProtected.DELETE("/surveys/:id", middleware.RequireAgentPermission("surveys.write"), adminHandler.DeleteSurvey)
			agentProtected.GET("/surveys/:id/responses/analytics", middleware.RequireAgentPermission("surveys.read"), agentAdminHandler.GetSurveyResponseAnalytics)
			agentProtected.GET("/datasets", middleware.RequireAgentPermission("datasets.read"), adminHandler.GetDatasets)
			agentProtected.POST("/datasets", middleware.RequireAgentPermission("datasets.write"), adminHandler.CreateDataset)
			agentProtected.GET("/datasets/:id/versions", middleware.RequireAgentPermission("datasets.read"), adminHandler.ListDatasetVersions)
			agentProtected.POST("/datasets/:id/publish", middleware.RequireAgentPermission("datasets.write"), adminHandler.PublishDatasetVersion)
			agentProtected.PATCH("/datasets/:id", middleware.RequireAgentPermission("datasets.write"), adminHandler.UpdateDataset)
			agentProtected.DELETE("/datasets/:id", middleware.RequireAgentPermission("datasets.write"), adminHandler.DeleteDataset)
			agentProtected.GET("/deid", middleware.RequireAgentPermission("deid.read"), agentAdminHandler.GetDeidUsage)
			agentProtected.POST("/deid/sessions/start", middleware.RequireAgentPermission("deid.write"), agentAdminHandler.StartDeidSession)
			agentProtected.GET("/deid/sessions/:session_id", middleware.RequireAgentPermission("deid.read"), agentAdminHandler.GetDeidSession)
			agentProtected.POST("/deid/sessions/:session_id/chunks/:chunk_index/annotate", middleware.RequireAgentPermission("deid.write"), agentAdminHandler.AnnotateDeidChunk)
			agentProtected.GET("/users", middleware.RequireAgentPermission("users.read"), adminHandler.GetUsers)
			agentProtected.PATCH("/users/:id", middleware.RequireAgentPermission("users.write"), adminHandler.UpdateUser)
			agentProtected.POST("/users/points-adjust", middleware.RequireAgentPermission("users.write"), adminHandler.AdjustUsersPoints)
			agentProtected.GET("/subscription-plans", middleware.RequireAgentPermission("plans.read"), adminHandler.GetSubscriptionPlans)
			agentProtected.POST("/subscription-plans", middleware.RequireAgentPermission("plans.write"), adminHandler.CreateSubscriptionPlan)
			agentProtected.PATCH("/subscription-plans/:id", middleware.RequireAgentPermission("plans.write"), adminHandler.UpdateSubscriptionPlan)
			agentProtected.DELETE("/subscription-plans/:id", middleware.RequireAgentPermission("plans.write"), adminHandler.DeactivateSubscriptionPlan)
			agentProtected.GET("/policies", middleware.RequireAgentPermission("policies.read"), adminHandler.GetPolicies)
			agentProtected.PATCH("/policies", middleware.RequireAgentPermission("policies.write"), adminHandler.UpdatePolicies)
			agentProtected.PATCH("/capabilities/:id", middleware.RequireAgentPermission("policies.write"), adminHandler.UpdateCapability)
			agentProtected.GET("/policy-writers", middleware.RequireAgentPermission("policies.read"), adminHandler.GetPolicyWriters)
			agentProtected.PUT("/policy-writers/:id", middleware.RequireAgentPermission("policies.write"), adminHandler.UpdatePolicyWriter)
			agentProtected.GET("/system-settings", middleware.RequireAgentPermission("system.read"), adminHandler.GetSystemSettings)
			agentProtected.PATCH("/system-settings", middleware.RequireAgentPermission("system.write"), adminHandler.UpdateSystemSettings)
			agentProtected.GET("/agents", middleware.RequireAgentPermission("agents.read"), agentAdminHandler.ListAccounts)
			agentProtected.POST("/agents", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.CreateAccount)
			agentProtected.GET("/agents/:id", middleware.RequireAgentPermission("agents.read"), agentAdminHandler.GetAccount)
			agentProtected.PATCH("/agents/:id", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.UpdateAccount)
			agentProtected.POST("/agents/:id/reveal-key", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.RevealKey)
			agentProtected.POST("/agents/:id/rotate-key", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.RotateKey)
		}
	}

	return r
}
