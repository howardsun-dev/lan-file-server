# LANShare

[![GitHub license](https://img.shields.io/github/license/howardsun-dev/LANShare)](./LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/howardsun-dev/LANShare)](https://github.com/howardsun-dev/LANShare/issues)
[![GitHub stars](https://img.shields.io/github/stars/howardsun-dev/LANShare)](https://github.com/howardsun-dev/LANShare/stars)
[![GitHub last commit](https://img.shields.io/github/last-commit/howardsun-dev/LANShare)](https://github.com/howardsun-dev/LANShare/commits/main)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=github-actions&logoColor=white)](https://github.com/howardsun-dev/LANShare/actions)

## Overview

LANShare is a **TypeScript/Node.js** local network file sharing tool designed for trusted environments. It provides a secure way to share folders between devices on the same LAN without exposing services to the public internet.

## ✨ Key Features

- **Browser Control UI** - Intuitive interface to select folders and start/stop sharing
- **Command Line Interface** - Direct folder sharing from terminal
- **Path Traversal Protection** - Blocks directory escape attempts for security
- **MIME Type Detection** - Proper content-type headers for all file types
- **Streaming File Transfer** - Efficient byte-streaming without loading entire files into memory
- **Health Check Endpoint** - `/healthz` for monitoring and uptime checks
- **Comprehensive Test Suite** - Unit, integration, and browser functional tests (Playwright + Vitest)

## 🔒 Security First

Designed for trusted networks only:
- No authentication (intended for LAN use behind firewalls)
- Path traversal protection prevents `../../` attacks
- Read-only file serving - no uploads, deletes, or modifications
- Should **NOT** be exposed to public internet

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/howardsun-dev/LANShare.git
cd LANShare
npm install

# Start with browser UI (default)
npm start

# Or share specific folder directly
npm start -- /path/to/shared/folder
```

## 📦 What's Included

- `src/` - Main application code
- `tests/` - Playwright (browser) + Vitest (unit/integration) tests
- `docs/` - Documentation and screenshots
- GitHub Actions CI/CD pipeline (lint → test → build)

## 💼 Perfect For

- Quick file transfers between trusted devices
- LAN parties, home networks, office workgroups
- Developers needing to share build artifacts locally
- Learning TypeScript backend development with Express

**[View Live Demo](https://howardsun.me)** | **[Report Bug](https://github.com/howardsun-dev/LANShare/issues)** | **[Request Feature](https://github.com/howardsun-dev/LANShare/issues)**
