# Change: Increase Backend Coverage for Dataset Marketplace Flows

## Why
Our roadmap requires production-level confidence. Dataset marketplace behavior (sorting + paid downloads with points) is business-critical but currently under-tested at the HTTP handler layer.

## What Changes
- Add focused Go handler tests for:
  - dataset listing sorting (`newest|downloads|samples`)
  - dataset paid download authorization + insufficient points behavior
  - successful downloads (download_count increments and file attachment response)
- Keep existing API behavior unchanged; this change is test/verification focused.

## Impact
- Improves confidence and regression detection without changing user-visible behavior.
- Contributes to future coverage gates (not enforced by this change).

