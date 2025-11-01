# Practical Oracle JET - Mock API

This small Express server serves the `.mock` files included in the Practical Oracle JET examples. It reads the raw HTTP response text in each `.mock` and returns the configured status, headers and body.

Usage

- From the repository root run:

  npm --prefix ./mock-api install
  npm --prefix ./mock-api start

- By default it uses `Chapter 13` mocks. To use a different chapter set the environment variable `CHAPTER`, for example:

  CHAPTER="Chapter 11" npm --prefix ./mock-api start

Endpoints

- The server maps request paths to the folder structure under `.../MyOnlineSupport/API/mocks`. It supports dynamic segments using the `__` placeholder found in the mocks (e.g. for ticket IDs).

Notes

- The server parses `HTTP/1.1 <status>` line and headers from the `.mock` file and forwards them. JSON bodies are parsed and returned as JSON responses when Content-Type is `application/json`.
