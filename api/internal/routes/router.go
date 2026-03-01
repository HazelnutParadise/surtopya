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

	// Add auth middleware (processes token but doesn't require it)
	r.Use(middleware.AuthMiddleware())

	api := r.Group("/api/v1")
	{
		// Health check
		api.GET("/health", handlers.HealthHandler)
		api.GET("/ready", handlers.ReadyHandler)

		// Survey routes
		surveyHandler := handlers.NewSurveyHandler()
		surveys := api.Group("/surveys")
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
			surveys.POST("/:id/unpublish", middleware.RequireAuth(), surveyHandler.UnpublishSurvey)
		}

		// Response routes
		responseHandler := handlers.NewResponseHandler()
		responses := api.Group("/responses")
		{
			responses.GET("/:id", responseHandler.GetResponse)
			responses.POST("/:id/answers", responseHandler.SubmitAnswer)
			responses.POST("/:id/submit", responseHandler.SubmitAllAnswers)
		}

		// Survey response routes (nested under surveys)
		api.POST("/surveys/:id/responses/start", responseHandler.StartResponse)
		api.GET("/surveys/:id/responses", middleware.RequireAuth(), responseHandler.GetSurveyResponses)

		// Dataset routes
		datasetHandler := handlers.NewDatasetHandler()
		datasets := api.Group("/datasets")
		{
			datasets.GET("", datasetHandler.GetDatasets)
			datasets.GET("/categories", datasetHandler.GetCategories)
			datasets.GET("/:id", datasetHandler.GetDataset)
			datasets.POST("/:id/download", datasetHandler.DownloadDataset)
		}

		// Bootstrap status
		adminHandler := handlers.NewAdminHandler()
		api.GET("/bootstrap", adminHandler.GetBootstrapStatus)
		api.GET("/pricing/plans", adminHandler.GetPricingPlans)

		// User profile and settings routes
		userSettingsHandler := handlers.NewUserSettingsHandler()
		userHandler := handlers.NewUserHandler()
		me := api.Group("/me", middleware.RequireAuth())
		{
			me.GET("", userHandler.GetProfile)
			me.PATCH("", userHandler.UpdateProfile)
			me.GET("/settings", userSettingsHandler.GetSettings)
			me.PATCH("/settings", userSettingsHandler.UpdateSettings)
		}

		// Admin routes
		admin := api.Group("/admin", middleware.RequireAuth(), middleware.RequireAdmin())
		{
			admin.GET("/surveys", adminHandler.GetSurveys)
			admin.PATCH("/surveys/:id", adminHandler.UpdateSurvey)
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
		}
	}

	return r
}
