package main

import (
	"context"
	"time"
)

func startDBReconnectLoop(
	ctx context.Context,
	interval time.Duration,
	isReady func() bool,
	connect func() error,
	onConnected func(),
	onConnectError func(error),
) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if isReady() {
				continue
			}

			if err := connect(); err != nil {
				if onConnectError != nil {
					onConnectError(err)
				}
				continue
			}

			onConnected()
		}
	}
}
