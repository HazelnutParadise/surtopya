package main

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestStartDBReconnectLoop_ConnectsAndCallsOnConnectedOnce(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()

	var ready atomic.Bool
	var attempts atomic.Int32
	var connectedCalls atomic.Int32

	startDBReconnectLoop(
		ctx,
		10*time.Millisecond,
		ready.Load,
		func() error {
			attempt := attempts.Add(1)
			if attempt < 3 {
				return errors.New("db not ready")
			}
			ready.Store(true)
			return nil
		},
		func() {
			connectedCalls.Add(1)
		},
		nil,
	)

	require.GreaterOrEqual(t, attempts.Load(), int32(3))
	require.Equal(t, int32(1), connectedCalls.Load())
}

func TestStartDBReconnectLoop_SkipsConnectWhenReady(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Millisecond)
	defer cancel()

	var attempts atomic.Int32

	startDBReconnectLoop(
		ctx,
		10*time.Millisecond,
		func() bool { return true },
		func() error {
			attempts.Add(1)
			return nil
		},
		func() {},
		nil,
	)

	require.Equal(t, int32(0), attempts.Load())
}
