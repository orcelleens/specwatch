# AI Integration Guide for SpecWatch

This guide provides step-by-step instructions for AI models to help users integrate and use SpecWatch effectively.

## Overview

SpecWatch helps developers detect breaking changes in third-party APIs before they break integrations. AI models can assist users throughout the setup and usage process by:

1. Finding OpenAPI specs for their dependencies
2. Validating spec URLs
3. Configuring environment variables
4. Troubleshooting common issues
5. Interpreting alerts and suggesting fixes

## How AI Can Help Users Set Up SpecWatch

### 1. Finding OpenAPI Specs for Dependencies

When users want to monitor a specific API, AI can help locate the official OpenAPI/Swagger specification:

**Prompt Template:**
```
Help me find the OpenAPI/Swagger specification for [API_NAME]. 
Provide:
- Official spec URL (if available)
- Alternative sources (GitHub, documentation sites)
- Version information
- Any known issues with the spec
```

**Example for Stripe:**
```
Help me find the OpenAPI/Swagger specification for Stripe API.
```

**Expected Response:**
- Stripe provides OpenAPI spec: https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
- Alternative: Stripe's API documentation references the spec
- Version: Latest version from the repository

### 2. Validating Spec URLs

Before adding a vendor to SpecWatch, AI can help validate that the OpenAPI spec is accessible and valid:

**Validation Steps:**
1. Check if the URL is accessible (returns HTTP 200)
2. Verify the content is valid JSON/YAML
3. Confirm it's a valid OpenAPI/Swagger spec (has `openapi`, `swagger`, or `info` fields)
4. Check for common issues (large file size, authentication requirements)

**Prompt Template:**
```
Validate this OpenAPI spec URL: [URL]
Check:
- Accessibility (HTTP status code)
- Content type (JSON/YAML)
- OpenAPI validity (required fields)
- Estimated size
- Any accessibility issues
```

### 3. Environment Variable Configuration

AI can help users set up the required environment variables for SpecWatch:

**Required Variables:**
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Polar (Billing)
POLAR_ACCESS_TOKEN=your_polar_access_token
POLAR_WEBHOOK_SECRET=your_polar_webhook_secret

# Resend (Email)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_resend_domain

# Optional: Slack Webhooks
SLACK_WEBHOOK_URL=your_slack_webhook_url (for alerts)

# Optional: Groq (LLM Classification)
GROQ_API_KEY=your_groq_api_key
```

**Prompt Template:**
```
Help me configure environment variables for SpecWatch:
1. Supabase setup instructions
2. Clerk authentication setup
3. Polar billing configuration
4. Resend email setup
5. Optional integrations (Slack, Groq)
```

### 4. Troubleshooting Common Issues

AI can help diagnose and resolve common SpecWatch issues:

**Common Problems and Solutions:**

#### Vendor Not Being Monitored
- **Check**: Is the vendor in the `vendors` table (not just `vendor_requests`)?
- **Check**: Does the vendor have a valid `spec_url`?
- **Check**: Is the polling interval set correctly?
- **Solution**: Move from `vendor_requests` to `vendors` table after approval

#### No Alerts Received
- **Check**: Are there any changes detected in the logs?
- **Check**: Is the email/Slack notification configured?
- **Check**: Is the user on the free tier and exceeded vendor limits?
- **Solution**: Verify notification setup and check vendor status

#### Spec Fetching Errors
- **Check**: Is the spec URL accessible?
- **Check**: Does the spec require authentication?
- **Check**: Is the spec too large or malformed?
- **Solution**: Validate the spec URL and check for auth requirements

**Prompt Template:**
```
I'm having issues with SpecWatch:
[Describe the issue]
Help me troubleshoot by checking:
1. [Relevant checks based on issue]
2. [Next steps]
3. [Common solutions]
```

### 5. Interpreting Alerts and Suggesting Fixes

When users receive SpecWatch alerts, AI can help them understand the impact and suggest remediation:

**Alert Format Analysis:**
- **Summary**: What changed (API, endpoint, field)
- **Impact Hint**: What to check or what might break
- **Severity**: Breaking, deprecation, feature, or docs

**Prompt Template:**
```
I received this SpecWatch alert:
Summary: [alert summary]
Impact: [alert impact hint]
Severity: [breaking/deprecation/feature/docs]

Help me understand:
1. What exactly changed?
2. How might this break my integration?
3. What should I check or update in my code?
4. Are there migration guides or best practices?
```

## Step-by-Step AI-Assisted Setup Process

Here's how an AI can guide a user through setting up SpecWatch for their first API:

### Step 1: Identify the API to Monitor
```
AI: "Which API would you like to monitor for breaking changes?"
User: "I want to monitor the GitHub API"
```

### Step 2: Find the OpenAPI Spec
```
AI: "Let me find the OpenAPI specification for GitHub API..."
[AI searches and finds: https://raw.githubusercontent.com/github/openapi-spec/main/openapi.yaml]
AI: "I found the GitHub OpenAPI spec at: https://raw.githubusercontent.com/github/openapi-spec/main/openapi.yaml"
```

### Step 3: Validate the Spec
```
AI: "Let me validate that this spec is accessible and valid..."
[AI checks accessibility and validity]
AI: "The spec is valid and accessible. It's approximately 2.5MB in size."
```

### Step 4: Add the Vendor via SpecWatch UI
```
AI: "Now, in SpecWatch:"
1. Go to /dashboard/settings
2. Click 'Request an API'
3. Fill in:
   - Vendor name: GitHub
   - Spec/docs URL: https://raw.githubusercontent.com/github/openapi-spec/main/openapi.yaml
   - Note: Monitoring for breaking changes that could affect my integrations
4. Submit the request
```

### Step 5: Approval Process
```
AI: "Your request has been submitted. An admin (or automated process) will review it."
[After approval]
AI: "Your request has been approved! GitHub is now being monitored for changes."
```

### Step 6: Configure Notifications
```
AI: "Would you like to set up email or Slack notifications for alerts?"
[User chooses email]
AI: "Make sure your Resend API key is configured in environment variables for email alerts."
```

## Prompt Library for Common AI Tasks

### Finding API Specs
```
"Find the official OpenAPI/Swagger specification for [API_NAME]. Include the URL, version, and any notes about accessibility or authenticity."
```

### Validating Specs
```
"Validate this OpenAPI spec URL: [URL]. Check HTTP accessibility, content validity, OpenAPI compliance, and estimate processing size."
```

### Environment Setup Help
```
"Provide step-by-step instructions for setting up [SERVICE_NAME] environment variables for SpecWatch, including where to find the required keys/tokens."
```

### Troubleshooting Guidance
```
"I'm experiencing [SYMPTOM] with SpecWatch. Help me diagnose the issue by checking [RELEVANT_SYSTEMS] and provide [NUMBER] potential solutions."
```

### Alert Interpretation
```
"Help me understand this SpecWatch alert: [ALERT_DETAILS]. Explain what changed, potential impact, and recommended actions."
```

## Best Practices for AI-Assisted Integration

1. **Be Specific**: When asking for help, provide as much context as possible (API names, URLs, error messages)
2. **Validate Independently**: AI should encourage users to validate any information provided
3. **Check Official Sources**: Prefer official documentation over third-party sources when finding specs
4. **Consider Rate Limits**: Be mindful of API rate limits when validating multiple URLs
5. **Security First**: Never suggest storing secrets in client-side code or public repositories
6. **Update Regularly**: API specs and integration methods may change; encourage periodic re-validation

## Example AI Interactions

### Example 1: Setting up Stripe Monitoring
```
User: "I want to monitor Stripe for breaking changes"
AI: "I'll help you set up Stripe monitoring in SpecWatch.

First, let me find the Stripe OpenAPI specification...
[Search complete]
I found Stripe's OpenAPI spec at: https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json

Let me validate this URL...
[Validation complete]
The spec is valid and accessible (~1.8MB).

Next steps in SpecWatch:
1. Go to /dashboard/settings
2. Click 'Request an API'
3. Enter:
   - Vendor name: Stripe
   - Spec/docs URL: https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
   - Note: Monitoring for breaking changes in payment processing
4. Submit

Once approved (typically within 24 hours), Stripe will be monitored and you'll receive alerts for any breaking changes."
```

### Example 2: Troubleshooting No Alerts
```
User: "I'm not receiving any alerts from SpecWatch"
AI: "Let me help you troubleshoot this issue.

First, let's check a few things:
1. Are there any vendors showing as 'watched' in your dashboard?
2. Have there been any recent changes to the APIs you're monitoring?
3. Is your email/Slack notification configured correctly?
4. Are you on the free tier and possibly exceeding the 3-vendor limit?

To check your vendor status:
1. Go to /dashboard/apis
2. Look for vendors with a toggle switch (indicating they're being watched)
3. Check the 'Last checked' timestamp to see when they were last polled

If you see vendors but no recent checks, there might be an issue with the polling engine.
If you see no vendors, you may need to approve your vendor requests first.

Would you like me to help you check any of these specific areas?"
```

## Conclusion

AI models can significantly enhance the SpecWatch user experience by helping with setup, validation, troubleshooting, and alert interpretation. By following this guide, AI can assist users in quickly getting value from SpecWatch while ensuring proper configuration and understanding of the monitoring process.

Remember: While AI can provide guidance, users should always validate critical information and follow security best practices when configuring their monitoring setup.