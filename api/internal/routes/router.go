package routes

import (
	"github.com/TimLai666/surtopya-api/internal/handlers"
	"github.com/TimLai666/surtopya-api/internal/middleware"
	"github.com/gin-gonic/gin"
)

type setupOptions struct {
	includeInternalApp bool
}

func freshHandler[T any](factory func() T, handle func(T, *gin.Context)) gin.HandlerFunc {
	return func(c *gin.Context) {
		handle(factory(), c)
	}
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

	// App-internal routes for frontend/BFF.
	if options.includeInternalApp {
		api := r.Group("/api")
		app := api.Group("/app", middleware.RequireInternalApp())
		{
			surveys := app.Group("/surveys")
			{
				// Public survey endpoints still require app-internal signature.
				surveys.GET("/public", freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).GetPublicSurveys))
				surveys.GET("/:id", freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).GetSurvey))

				// Authenticated endpoints.
				surveys.POST("", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).CreateSurvey))
				surveys.GET("/my", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).GetMySurveys))
				surveys.PUT("/:id", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).UpdateSurvey))
				surveys.DELETE("/:id", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).DeleteSurvey))
				surveys.POST("/:id/publish", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).PublishSurvey))
				surveys.POST("/:id/responses/open", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).OpenSurveyResponses))
				surveys.POST("/:id/responses/close", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).CloseSurveyResponses))
				surveys.GET("/:id/versions", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).ListSurveyVersions))
				surveys.GET("/:id/versions/:versionNumber", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).GetSurveyVersion))
				surveys.POST("/:id/versions/:versionNumber/restore-draft", middleware.RequireAuth(), freshHandler(handlers.NewSurveyHandler, (*handlers.SurveyHandler).RestoreSurveyVersionDraft))
			}

			appResponses := app.Group("/responses")
			{
				appResponses.GET("/my", middleware.RequireAuth(), freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).GetMyCompletedResponses))
				appResponses.GET("/:id", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).GetResponse))
				appResponses.POST("/:id/answers", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).SubmitAnswer))
				appResponses.POST("/:id/submit", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).SubmitAllAnswers))
				appResponses.POST("/claim-anonymous-points", middleware.RequireAuth(), freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).ClaimAnonymousPoints))
				appResponses.POST("/forfeit-anonymous-points", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).ForfeitAnonymousPoints))
			}

			app.GET("/surveys/:id/responses", middleware.RequireAuth(), freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).GetSurveyResponses))
			app.GET("/surveys/:id/responses/analytics", middleware.RequireAuth(), freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).GetSurveyResponseAnalytics))
			app.POST("/surveys/:id/responses/start", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).StartResponse))
			app.POST("/surveys/:id/responses/submit-anonymous", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).SubmitAnonymousResponse))
			app.POST("/surveys/:id/drafts/start", middleware.RequireAuth(), freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).StartDraft))
			app.POST("/surveys/:id/drafts/restart", middleware.RequireAuth(), freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).RestartDraft))

			appDrafts := app.Group("/drafts", middleware.RequireAuth())
			{
				appDrafts.GET("/my", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).GetMyDrafts))
				appDrafts.POST("/:id/answers", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).SaveDraftAnswer))
				appDrafts.POST("/:id/answers/bulk", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).SaveDraftAnswersBulk))
				appDrafts.POST("/:id/submit", freshHandler(handlers.NewResponseHandler, (*handlers.ResponseHandler).SubmitDraft))
			}

			app.GET("/bootstrap", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetBootstrapStatus))
			app.GET("/config", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetPublicConfig))
			app.GET("/pricing/plans", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetPricingPlans))
			app.GET("/authors/:slug", freshHandler(handlers.NewAuthorHandler, (*handlers.AuthorHandler).GetAuthor))

			me := app.Group("/me", middleware.RequireAuth())
			{
				me.GET("", freshHandler(handlers.NewUserHandler, (*handlers.UserHandler).GetProfile))
				me.PATCH("", freshHandler(handlers.NewUserHandler, (*handlers.UserHandler).UpdateProfile))
				me.GET("/settings", freshHandler(handlers.NewUserSettingsHandler, (*handlers.UserSettingsHandler).GetSettings))
				me.PATCH("/settings", freshHandler(handlers.NewUserSettingsHandler, (*handlers.UserSettingsHandler).UpdateSettings))
			}

			admin := app.Group("/admin", middleware.RequireAuth(), middleware.RequireAdmin())
			{
				admin.GET("/surveys", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSurveys))
				admin.PATCH("/surveys/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateSurvey))
				admin.POST("/surveys/:id/publish", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).PublishSurveyVersion))
				admin.POST("/surveys/:id/responses/open", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).OpenSurveyResponses))
				admin.POST("/surveys/:id/responses/close", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).CloseSurveyResponses))
				admin.GET("/surveys/:id/versions", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).ListSurveyVersions))
				admin.GET("/surveys/:id/versions/:versionNumber", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSurveyVersion))
				admin.POST("/surveys/:id/versions/:versionNumber/restore-draft", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).RestoreSurveyVersionDraft))
				admin.DELETE("/surveys/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).DeleteSurvey))
				admin.GET("/datasets", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetDatasets))
				admin.POST("/datasets", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).CreateDataset))
				admin.GET("/datasets/:id/versions", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).ListDatasetVersions))
				admin.POST("/datasets/:id/publish", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).PublishDatasetVersion))
				admin.PATCH("/datasets/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateDataset))
				admin.DELETE("/datasets/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).DeleteDataset))
				admin.GET("/deid/reviews", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).ListDeidReviewJobs))
				admin.GET("/deid/reviews/:jobId", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetDeidReviewJob))
				admin.POST("/deid/reviews/:jobId/complete", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).CompleteDeidReview))
				admin.GET("/users", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetUsers))
				admin.POST("/users/points-adjust", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).AdjustUsersPoints))
				admin.PATCH("/users/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateUser))
				admin.GET("/subscription-plans", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSubscriptionPlans))
				admin.POST("/subscription-plans", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).CreateSubscriptionPlan))
				admin.PATCH("/subscription-plans/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateSubscriptionPlan))
				admin.DELETE("/subscription-plans/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).DeactivateSubscriptionPlan))
				admin.GET("/policies", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetPolicies))
				admin.PATCH("/policies", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdatePolicies))
				admin.PATCH("/capabilities/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateCapability))
				admin.GET("/policy-writers", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetPolicyWriters))
				admin.PUT("/policy-writers/:id", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdatePolicyWriter))
				admin.GET("/system-settings", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSystemSettings))
				admin.PATCH("/system-settings", freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateSystemSettings))
				admin.GET("/agents", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).ListAccounts))
				admin.POST("/agents", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).CreateAccount))
				admin.GET("/agents/:id", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetAccount))
				admin.PATCH("/agents/:id", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).UpdateAccount))
				admin.POST("/agents/:id/reveal-key", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).RevealKey))
				admin.POST("/agents/:id/rotate-key", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).RotateKey))
			}

			app.POST("/ui-events", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).IngestUIEvent))
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
			datasets.GET("", freshHandler(handlers.NewDatasetHandler, (*handlers.DatasetHandler).GetDatasets))
			datasets.GET("/categories", freshHandler(handlers.NewDatasetHandler, (*handlers.DatasetHandler).GetCategories))
			datasets.GET("/:id", freshHandler(handlers.NewDatasetHandler, (*handlers.DatasetHandler).GetDataset))
			datasets.GET("/:id/versions", freshHandler(handlers.NewDatasetHandler, (*handlers.DatasetHandler).ListDatasetVersions))
			datasets.POST("/:id/purchase", freshHandler(handlers.NewDatasetHandler, (*handlers.DatasetHandler).PurchaseDataset))
			datasets.POST("/:id/download", freshHandler(handlers.NewDatasetHandler, (*handlers.DatasetHandler).DownloadDataset))
		}

		v1.GET("/authors/:slug", freshHandler(handlers.NewAuthorHandler, (*handlers.AuthorHandler).GetAuthor))

		agentDocs := v1.Group("/agent-admin")
		{
			agentDocs.GET("", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetUsageIndex))
			agentDocs.GET("/openapi.json", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetOpenAPI))
		}

		agentProtected := v1.Group("/agent-admin", middleware.RequireAgentAdmin())
		{
			agentProtected.GET("/me", freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetMe))
			agentProtected.GET("/logs", middleware.RequireAgentPermission("logs.read"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).ListLogs))
			agentProtected.GET("/logs/:id", middleware.RequireAgentPermission("logs.read"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetLog))
			agentProtected.GET("/surveys", middleware.RequireAgentPermission("surveys.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSurveys))
			agentProtected.PATCH("/surveys/:id", middleware.RequireAgentPermission("surveys.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateSurvey))
			agentProtected.POST("/surveys/:id/publish", middleware.RequireAgentPermission("surveys.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).PublishSurveyVersion))
			agentProtected.POST("/surveys/:id/responses/open", middleware.RequireAgentPermission("surveys.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).OpenSurveyResponses))
			agentProtected.POST("/surveys/:id/responses/close", middleware.RequireAgentPermission("surveys.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).CloseSurveyResponses))
			agentProtected.GET("/surveys/:id/versions", middleware.RequireAgentPermission("surveys.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).ListSurveyVersions))
			agentProtected.GET("/surveys/:id/versions/:versionNumber", middleware.RequireAgentPermission("surveys.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSurveyVersion))
			agentProtected.POST("/surveys/:id/versions/:versionNumber/restore-draft", middleware.RequireAgentPermission("surveys.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).RestoreSurveyVersionDraft))
			agentProtected.DELETE("/surveys/:id", middleware.RequireAgentPermission("surveys.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).DeleteSurvey))
			agentProtected.GET("/surveys/:id/responses/analytics", middleware.RequireAgentPermission("surveys.read"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetSurveyResponseAnalytics))
			agentProtected.GET("/datasets", middleware.RequireAgentPermission("datasets.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetDatasets))
			agentProtected.POST("/datasets", middleware.RequireAgentPermission("datasets.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).CreateDataset))
			agentProtected.GET("/datasets/:id/versions", middleware.RequireAgentPermission("datasets.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).ListDatasetVersions))
			agentProtected.POST("/datasets/:id/publish", middleware.RequireAgentPermission("datasets.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).PublishDatasetVersion))
			agentProtected.PATCH("/datasets/:id", middleware.RequireAgentPermission("datasets.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateDataset))
			agentProtected.DELETE("/datasets/:id", middleware.RequireAgentPermission("datasets.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).DeleteDataset))
			agentProtected.GET("/deid", middleware.RequireAgentPermission("deid.read"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetDeidUsage))
			agentProtected.POST("/deid/sessions/start", middleware.RequireAgentPermission("deid.write"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).StartDeidSession))
			agentProtected.GET("/deid/sessions/:session_id", middleware.RequireAgentPermission("deid.read"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetDeidSession))
			agentProtected.POST("/deid/sessions/:session_id/chunks/:chunk_index/annotate", middleware.RequireAgentPermission("deid.write"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).AnnotateDeidChunk))
			agentProtected.GET("/users", middleware.RequireAgentPermission("users.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetUsers))
			agentProtected.PATCH("/users/:id", middleware.RequireAgentPermission("users.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateUser))
			agentProtected.POST("/users/points-adjust", middleware.RequireAgentPermission("users.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).AdjustUsersPoints))
			agentProtected.GET("/subscription-plans", middleware.RequireAgentPermission("plans.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSubscriptionPlans))
			agentProtected.POST("/subscription-plans", middleware.RequireAgentPermission("plans.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).CreateSubscriptionPlan))
			agentProtected.PATCH("/subscription-plans/:id", middleware.RequireAgentPermission("plans.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateSubscriptionPlan))
			agentProtected.DELETE("/subscription-plans/:id", middleware.RequireAgentPermission("plans.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).DeactivateSubscriptionPlan))
			agentProtected.GET("/policies", middleware.RequireAgentPermission("policies.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetPolicies))
			agentProtected.PATCH("/policies", middleware.RequireAgentPermission("policies.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdatePolicies))
			agentProtected.PATCH("/capabilities/:id", middleware.RequireAgentPermission("policies.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateCapability))
			agentProtected.GET("/policy-writers", middleware.RequireAgentPermission("policies.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetPolicyWriters))
			agentProtected.PUT("/policy-writers/:id", middleware.RequireAgentPermission("policies.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdatePolicyWriter))
			agentProtected.GET("/system-settings", middleware.RequireAgentPermission("system.read"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).GetSystemSettings))
			agentProtected.PATCH("/system-settings", middleware.RequireAgentPermission("system.write"), freshHandler(handlers.NewAdminHandler, (*handlers.AdminHandler).UpdateSystemSettings))
			agentProtected.GET("/agents", middleware.RequireAgentPermission("agents.read"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).ListAccounts))
			agentProtected.POST("/agents", middleware.RequireAgentPermission("agents.write"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).CreateAccount))
			agentProtected.GET("/agents/:id", middleware.RequireAgentPermission("agents.read"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).GetAccount))
			agentProtected.PATCH("/agents/:id", middleware.RequireAgentPermission("agents.write"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).UpdateAccount))
			agentProtected.POST("/agents/:id/reveal-key", middleware.RequireAgentPermission("agents.write"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).RevealKey))
			agentProtected.POST("/agents/:id/rotate-key", middleware.RequireAgentPermission("agents.write"), freshHandler(handlers.NewAgentAdminHandler, (*handlers.AgentAdminHandler).RotateKey))
		}
	}

	return r
}
