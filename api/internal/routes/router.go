package routes

import (
	"github.com/TimLai666/surtopya-api/internal/handlers"
	"github.com/TimLai666/surtopya-api/internal/middleware"
	"github.com/gin-gonic/gin"
)

// SetupRouter configures the API routes
func SetupRouter() *gin.Engine {
	r := gin.Default()

	// Add CORS middleware
	r.Use(middleware.CORSMiddleware())

	// Correlation id + structured request logging
	r.Use(middleware.RequestLoggingMiddleware())

	// Guard v1 APIs that require an available database.
	r.Use(middleware.RequireDBReady())

	// Add auth middleware (processes token but doesn't require it)
	r.Use(middleware.AuthMiddleware())

	api := r.Group("/api")
	{
		responseHandler := handlers.NewResponseHandler()

		// App-internal write routes for survey response flow.
		app := api.Group("/app", middleware.RequireInternalApp())
		{
			appResponses := app.Group("/responses")
			{
				appResponses.POST("/:id/answers", responseHandler.SubmitAnswer)
				appResponses.POST("/:id/submit", responseHandler.SubmitAllAnswers)
				appResponses.POST("/claim-anonymous-points", middleware.RequireAuth(), responseHandler.ClaimAnonymousPoints)
				appResponses.POST("/forfeit-anonymous-points", responseHandler.ForfeitAnonymousPoints)
			}

			app.POST("/surveys/:id/responses/start", responseHandler.StartResponse)
			app.POST("/surveys/:id/responses/submit-anonymous", responseHandler.SubmitAnonymousResponse)
			app.POST("/surveys/:id/drafts/start", middleware.RequireAuth(), responseHandler.StartDraft)

			appDrafts := app.Group("/drafts", middleware.RequireAuth())
			{
				appDrafts.POST("/:id/answers", responseHandler.SaveDraftAnswer)
				appDrafts.POST("/:id/answers/bulk", responseHandler.SaveDraftAnswersBulk)
				appDrafts.POST("/:id/submit", responseHandler.SubmitDraft)
			}
		}

		v1 := api.Group("/v1")
		{
			// Health check
			v1.GET("/health", handlers.HealthHandler)
			v1.GET("/ready", handlers.ReadyHandler)

			// Survey routes
			surveyHandler := handlers.NewSurveyHandler()
			surveys := v1.Group("/surveys")
			{
				// Public endpoints
				surveys.GET("/public", surveyHandler.GetPublicSurveys)
				surveys.GET("/:id", surveyHandler.GetSurvey)

				// Authenticated endpoints
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

			// Response routes
			responses := v1.Group("/responses")
			{
				responses.GET("/:id", responseHandler.GetResponse)
			}

			// Survey response read routes (nested under surveys)
			v1.GET("/surveys/:id/responses", middleware.RequireAuth(), responseHandler.GetSurveyResponses)
			v1.GET("/surveys/:id/responses/analytics", middleware.RequireAuth(), responseHandler.GetSurveyResponseAnalytics)

			// Authenticated draft read routes
			drafts := v1.Group("/drafts", middleware.RequireAuth())
			{
				drafts.GET("/my", responseHandler.GetMyDrafts)
			}

			// Dataset routes
			datasetHandler := handlers.NewDatasetHandler()
			datasets := v1.Group("/datasets")
			{
				datasets.GET("", datasetHandler.GetDatasets)
				datasets.GET("/categories", datasetHandler.GetCategories)
				datasets.GET("/:id", datasetHandler.GetDataset)
				datasets.POST("/:id/download", datasetHandler.DownloadDataset)
			}

			// Bootstrap status
			adminHandler := handlers.NewAdminHandler()
			v1.GET("/bootstrap", adminHandler.GetBootstrapStatus)
			v1.GET("/config", adminHandler.GetPublicConfig)
			v1.GET("/pricing/plans", adminHandler.GetPricingPlans)

			// User profile and settings routes
			userSettingsHandler := handlers.NewUserSettingsHandler()
			userHandler := handlers.NewUserHandler()
			me := v1.Group("/me", middleware.RequireAuth())
			{
				me.GET("", userHandler.GetProfile)
				me.PATCH("", userHandler.UpdateProfile)
				me.GET("/settings", userSettingsHandler.GetSettings)
				me.PATCH("/settings", userSettingsHandler.UpdateSettings)
			}

			// Admin routes
			admin := v1.Group("/admin", middleware.RequireAuth(), middleware.RequireAdmin())
			{
				agentAdminHandler := handlers.NewAgentAdminHandler()
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
				admin.PATCH("/datasets/:id", adminHandler.UpdateDataset)
				admin.DELETE("/datasets/:id", adminHandler.DeleteDataset)
				admin.GET("/users", adminHandler.GetUsers)
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

			agentAdminHandler := handlers.NewAgentAdminHandler()
			v1.POST("/ui-events", agentAdminHandler.IngestUIEvent)

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
				agentProtected.GET("/surveys/:id/responses/analytics", middleware.RequireAgentPermission("surveys.read"), agentAdminHandler.GetSurveyResponseAnalytics)
				agentProtected.GET("/agents", middleware.RequireAgentPermission("agents.read"), agentAdminHandler.ListAccounts)
				agentProtected.POST("/agents", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.CreateAccount)
				agentProtected.GET("/agents/:id", middleware.RequireAgentPermission("agents.read"), agentAdminHandler.GetAccount)
				agentProtected.PATCH("/agents/:id", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.UpdateAccount)
				agentProtected.POST("/agents/:id/reveal-key", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.RevealKey)
				agentProtected.POST("/agents/:id/rotate-key", middleware.RequireAgentPermission("agents.write"), agentAdminHandler.RotateKey)
			}
		}
	}

	return r
}
