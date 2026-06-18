# AI Career Diagnostic Tool

## Overview
The AI Career Diagnostic Tool is designed to assess a professional's AI-readiness, provide personalized career insights, and generate shareable content for professional networks like LinkedIn. It analyzes inputs across key dimensions of AI adoption, including project management, workflow automation, and continuous upskilling.

## How It Works
The tool functions as an "AI Career Coach" that evaluates user inputs based on a structured scoring rubric. It considers job roles, years of experience, and proactive AI behaviors to generate:
- **Readiness Rating:** A numerical score (0-100).
- **Persona Profile:** A tailored classification of the user's current stance on AI.
- **Actionable Insights:** High-impact recommendations to improve AI adoption.
- **LinkedIn Snippet:** A ready-to-share social media post to engage professional networks.

## Scoring Rubric
The diagnostic evaluates the user across several categories, assigning points (A=0, B=1, C=2, D=3, E=4):
- **Experience**
- **AI Workflow Adoption**
- **AI Project Management**
- **Handling Uncertainty**
- **Agent/Automation Usage**
- **Response to Disruption**
- **Weekly Upskilling**

*Note: The model applies role-based normalization (e.g., higher expectations for Architects/Tech Leads regarding AI project management) to ensure relevant feedback.*

## Usage
To implement the diagnostic tool:
1. **Configure the System Prompt:** Use the provided system prompt template that defines the role, scoring logic, and output format.
2. **Collect Input:** Gather the 8 key data points from the user.
3. **Generate Diagnostic:** Process inputs through an LLM to receive the tailored analysis.
4. **Share:** Use the generated LinkedIn snippet to share results and spark professional discussions.

## License
[Insert License Information Here]
