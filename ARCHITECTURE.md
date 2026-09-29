# Architecture: String Seed Generator

## Overview

String Seed Generator is a lightweight, client-side JavaScript implementation of the **SSoT (String Seed of Thought)** protocol, an algorithmic approach to enforcing diversity in generative AI outputs. The project consists of a core, dependency-free logic library (`stringseed.js`) and an interactive visual demonstration (`index.html`).

The architecture is designed to enforce the protocol's primary mandate: **verifiable randomness**. It ensures that discretionary choices are derived mathematically from a cryptographic seed, preventing distribution collapse (where models default to their most likely "prior" response).

## Core Components

### 1. The Core Library (`stringseed.js`)

The `StringSeed` class provides a modular implementation of the SSoT algorithm. It is designed to be easily embeddable in broader LLM workflows or prompt engineering pipelines.

**Key Responsibilities:**
- **Seed Generation:** Uses the Web Crypto API (`crypto.getRandomValues()`) to produce cryptographically secure pseudo-random hex strings.
- **Axis Management:** Maintains a registry of "axes" (dimensions of choice), each mapped to an array of discrete candidates.
- **Deterministic Resolution:** Implements the core SSoT mapping arithmetic:
  1. Extracts non-overlapping 4-character hex slices from the master seed.
  2. Parses the slice into an integer.
  3. Applies modulo arithmetic (`int % candidates.length`) to select a candidate.
- **Provenance Generation:** Generates a plaintext, verifiable block documenting the exact mathematical derivation of every choice. This block acts as a proof of execution.

### 2. The Visualizer (`index.html`)

A single-page web application that serves as an interactive, visual proof-of-concept for the SSoT protocol. It translates the abstract concept of "axes" into the concrete properties of geometric shapes.

**Key Responsibilities:**
- **Rendering:** Uses the **p5.js** library to draw shapes onto an HTML5 canvas.
- **Application State:** Maintains the current seed and dynamically re-renders the canvas when the seed is modified (either manually or via the "New" button).
- **Axis Implementation:** Registers 6 specific axes per shape (Type, Color, Size, Rotation, X-Position, Y-Position) with the `StringSeed` instance.
- **Transparency:** Displays the real-time provenance block alongside a shape legend, allowing users to cross-reference the visual output against the verifiable arithmetic.

### 3. Protocol Enforcement Rules (`docs/SKILL.md`)

The repository includes a detailed Markdown document that serves dual purposes:
- **Conceptual Architecture:** It outlines the failure modes the tool is designed to prevent (e.g., "ceremonial SSoT" or narrative rationalization).
- **Agent Skill:** It acts as an operational prompt guideline (an Antigravity Skill) for LLMs, dictating the step-by-step rules for applying the protocol to long-form copy and creative generation.

## Data Flow

1. **Entropy Collection:** A random hex string (the seed) is generated or provided by the user.
2. **Schema Definition:** The application defines a schema of axes and their valid candidates.
3. **Resolution (`StringSeed.resolve`):** 
   - The hex seed is sliced into 4-character chunks.
   - Each chunk is mathematically mapped to a specific candidate index.
4. **Execution:** The selected choices are fed into the application logic (e.g., rendering a scene, composing a prompt, or writing a document).
5. **Provenance Validation:** A provenance block is generated and preserved, allowing external reviewers or systems to verify that the output was mathematically determined by the seed.

## Design Principles

- **Zero-Dependency Core:** `stringseed.js` relies entirely on native browser/Node APIs (ES6, Web Crypto API). This ensures maximum portability across different JavaScript environments.
- **Verifiability:** The system is built around the "provenance block." Outputs are structurally designed to be auditable via simple external arithmetic (e.g., running `echo $((16#edc1 % 8))` in a shell).
- **Mathematical Independence:** The slicing algorithm uses non-overlapping segments of the seed to ensure that the selection on one axis has no mathematical correlation with the selection on another axis.
