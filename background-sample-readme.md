Fetched content from https://developers.google.com/workspace/add-ons/samples/gmail-sentiment-analysis-ai on 2025-08-01 15:36:42

Skip to main content
Workspace
Add-ons
Workspace
Home
Add-ons
Overview
Guides
Reference
Samples
Support
All products
More
Resources
More
Overview
Google Workspace add-ons
Analyze and label Gmail messages with Gemini
Preview links from Google Books
Copy macros
Get team member details
Translate text
Editor add-ons
Clean up data in Sheets
Show progress bars in Slides
Node.js codelab
Learning resources
Add-on video library
GitHub code samples
GitHub OAuth 2.0 Apps Script library
Home
Google Workspace
Add-ons
Samples
Was this helpful?
Send feedback
Analyze and label Gmail messages with Gemini and Vertex AI
bookmark_border
On this page
Objectives
About this solution
How it works
Prerequisites
Set up your environment

This solution uses Vertex AI and Gemini to analyze Gmail messages and label them based on their sentiment.

Coding level: Intermediate
Duration: 30 minutes
Project type: Google Workspace add-on

Figure 1: The Sentiment Analysis add-on displays a sidebar in Gmail where users can prompt Gemini to analyze and apply labels to messages based on the sentiment.
Figure 2: The add-on labels a Gmail message with the label NEUTRAL TONE 😐.
Figure 3: The add-on labels a Gmail message with the label HAPPY TONE 😊.
Figure 4: The add-on labels a Gmail message with the label UPSET TONE 😡.
Objectives
Understand what the solution does.
Understand what the Google services do within the solution.
Set up the environment.
Set up the Google Apps Script project.
Run the script.
About this solution

This solution is a Google Workspace add-on that applies labels based on the sentiment of Gmail messages. To analyze the message content, the add-on uses Vertex AI to prompt the Gemini 2.5 Flash model and return one of the following sentiments:

Positive
Negative
Neutral

With the response from Gemini, the add-on applies a corresponding Gmail label to the message.

To limit the request to the Vertex AI API, this add-on only analyzes and applies labels to the 10 most recent messages in the Gmail user's inbox. To learn more about quotas and limits, visit the Vertex AI documentation.

How it works

This solution is built in Google Apps Script and uses the following Google services and products:

Vertex AI API–Prompts the Gemini 2.5 Flash model to analyze the content of Gmail messages and identify the sentiment.

Apps Script services:

Gmail service–Retrieves and applies labels to Gmail messages. Optionally, creates sample messages for testing the add-on.
Card service–Creates the user interface of the add-on that appears as a sidebar in Gmail.
Url Fetch service–Connects to Vertex AI API for sentiment analysis.
Script service– To call the Vertex AI API, gets a OAuth 2.0 access token for the add-on using the getOAuthToken method.
Caution: Calling Vertex AI API using the getOAuthToken method is for example purposes only. To use this add-on outside of personal use, we recommend authenicating using a service account.
Prerequisites
A Google Cloud project with billing enabled. To learn if you have access, see Permissions required to enable billing.
Set up your environment

This section explains how configure and set up your environment in the Google Cloud console and Apps Script.

Configure your Cloud project in the Google Cloud console

This section shows you how to enable the Vertex AI API and configure the OAuth consent screen in your Cloud project.

Enable the Vertex AI API

In the Google Cloud console, open your Google Cloud project and enable the Vertex AI API:

Enable the API

Confirm that you're enabling the API in the correct Cloud project, then click Next.

Confirm that you're enabling the correct API, then click Enable.

Configure the OAuth consent screen

Google Workspace add-ons require a consent screen configuration. Configuring your add-on's OAuth consent screen defines what Google displays to users.

In the Google Cloud console, go to Menu menu > Google Auth platform > Branding.

Go to Branding

If you have already configured the Google Auth platform, you can configure the following OAuth Consent Screen settings in Branding, Audience, and Data Access. If you see a message that says Google Auth platform not configured yet, click Get Started:
Under App Information, in App name, enter a name for the app.
In User support email, choose a support email address where users can contact you if they have questions about their consent.
Click Next.
Under Audience, select Internal.
Click Next.
Under Contact Information, enter an Email address where you can be notified about any changes to your project.
Click Next.
Under Finish, review the Google API Services User Data Policy and if you agree, select I agree to the Google API Services: User Data Policy.
Click Continue.
Click Create.
For now, you can skip adding scopes. In the future, when you create an app for use outside of your Google Workspace organization, you must change the User type to External. Then add the authorization scopes that your app requires. To learn more, see the full Configure OAuth consent guide.
Create and set up your Apps Script project

To create and set up your Apps Script project for the add-on, complete the following steps:

Click the following button to open the Gmail Sentiment Analysis with Gemini and Vertex AI Apps Script project.
Open the Apps Script project

Click Overview info_outline.

On the overview page, click Make a copy .

Get the number of your Cloud project:

In the Google Cloud console, go to Menu menu > IAM & Admin > Settings.

Go to IAM & Admin Settings

In the Project number field, copy the value.

Connect your Cloud project with your Apps Script project:

In your copied Apps Script project, click Project Settings .
Under Google Cloud Platform (GCP) Project, click Change project.
In GCP project number, paste the Cloud project number.
Click Set project.
Test the add-on

To try out the add-on, install a test deployment and then open the add-on in Gmail:

Create and install an Apps Script test deployment:
In your copied Apps Script project, click Editor code.
Open the Code.gs file and click Run. When prompted, authorize the script.
Click Deploy > Test deployments.
Click Install > Done.

Open Gmail.

Go to Gmail

On the right sidebar, open the add-on sentiment_very_dissatisfiedSentiment Analysis.

If prompted, authorize the add-on.

Optional: To create messages to test with your add-on, click Generate sample emails. Three messages appear in your inbox. If you don't see them, refresh the page.

To add labels, click Analyze emails.

The add-on reviews the latest 10 messages in your inbox and then applies one of the following labels based on the message content:

HAPPY TONE 😊
NEUTRAL TONE 😐
UPSET TONE 😡
Review the code

Review the Apps Script code for this solution:

View source code
Clean up

To avoid incurring charges to your Google Cloud account for the resources used in this tutorial, we recommend that you delete the Cloud project.

Caution: Deleting a project has the following effects:

Everything in the project is deleted. If you used an existing project for this tutorial, when you delete it, you also delete any other work you've done in the project.
Custom project IDs are lost. When you created this project, you might have created a custom project ID that you want to use in the future. To preserve the URLs that use the project ID, such as a URL on appspot.com, delete the selected resources inside the project instead of deleting the whole project.

If you plan to explore multiple tutorials and quickstarts, reusing projects can help you avoid exceeding project quota limits.

In the Google Cloud console, go to the Manage resources page. Click Menu menu > IAM & Admin > Manage Resources.

Go to Resource Manager

In the project list, select the project you want to delete and then click Delete delete.
In the dialog, type the project ID and then click Shut down to delete the project.
Next steps
Extending Gmail with Google Workspace add-ons
Extend the Google Workspace UI
Build Google Workspace add-ons
Was this helpful?
Send feedback

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-07-30 UTC.

Blog
X (Twitter)
Code Samples
Codelabs
Videos
Google Workspace for Developers
Platform overview
Developer products
Developer support
Terms of Service
Tools
Admin console
Apps Script Dashboard
Google Cloud console
APIs Explorer
Connect
Blog
Newsletter
X (Twitter)
YouTube
Android
Chrome
Firebase
Google Cloud Platform
Google AI
All products
Terms
Privacy
Sign up for the Google for Developers newsletter
Subscribe

End of content from https://developers.google.com/workspace/add-ons/samples/gmail-sentiment-analysis-ai
Selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit on 2025-08-01 15:37:19

/*
Copyright 2024-2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0
…  // Build and return the action response
  return actionResponseBuilder.build();
}

End of selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit
Selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit on 2025-08-01 15:37:24

/*
Copyright 2024 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0
…  return buildHomepageCard();
}

End of selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit
Selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit on 2025-08-01 15:37:28

/*
Copyright 2024-2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0
…("Successfully generated sample emails");
}

End of selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit
Selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit on 2025-08-01 15:37:32

/*
Copyright 2024-2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0
…  const parsedResponse = JSON.parse(response.getContentText());
  const sentimentResponse = JSON.parse(parsedResponse.candidates[0].content.parts[0].text).response;

  // Return the sentiment
  return sentimentResponse;
}

End of selected content from https://script.google.com/home/projects/1Z2gfvr0oYn68ppDtQbv0qIuKKVWhvwOTr-gCE0GFKVjNk8NDlpfJAGAr/edit
