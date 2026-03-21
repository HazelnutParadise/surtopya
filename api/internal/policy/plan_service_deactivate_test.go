package policy

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestService_DeactivateSubscriptionPlan_ImmediatePersistsReplacement(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	svc := NewService(db)
	actorUserID := uuid.New()
	sourcePlanID := uuid.New()
	freePlanID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT code, is_active").
		WithArgs(sourcePlanID).
		WillReturnRows(sqlmock.NewRows([]string{"code", "is_active"}).AddRow("pro", true))
	mock.ExpectQuery("SELECT id, code, is_active").
		WithArgs("free").
		WillReturnRows(sqlmock.NewRows([]string{"id", "code", "is_active"}).AddRow(freePlanID, "free", true))
	mock.ExpectExec("UPDATE user_memberships um").
		WithArgs(sourcePlanID, freePlanID, true).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("UPDATE membership_tiers").
		WithArgs(sourcePlanID, freePlanID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO policy_audit_logs").
		WithArgs(
			sqlmock.AnyArg(),
			actorUserID,
			"subscription_plan_deactivate",
			"membership_tier",
			"pro",
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM membership_tiers t").
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"code",
			"name",
			"name_i18n",
			"description_i18n",
			"is_active",
			"is_purchasable",
			"show_on_pricing",
			"price_cents_usd",
			"billing_interval",
			"allow_renewal_for_existing",
			"monthly_points_grant",
			"max_active_surveys",
			"replacement_tier_code",
		}).AddRow(
			sourcePlanID,
			"pro",
			"Pro",
			[]byte(`{"zh-TW":"Pro","en":"Pro","ja":"Pro"}`),
			[]byte(`{"zh-TW":"desc","en":"desc","ja":"desc"}`),
			false,
			true,
			true,
			0,
			"month",
			false,
			0,
			nil,
			"free",
		))

	plan, migratedUsers, err := svc.DeactivateSubscriptionPlan(context.Background(), actorUserID, sourcePlanID, SubscriptionPlanDeactivate{
		ReplacementTierCode: "free",
		ExecutionTiming:     PlanDeactivationImmediate,
	})
	require.NoError(t, err)
	require.Equal(t, int64(2), migratedUsers)
	require.NotNil(t, plan.ReplacementTierCode)
	require.Equal(t, "free", *plan.ReplacementTierCode)
	require.NoError(t, mock.ExpectationsWereMet())
}
