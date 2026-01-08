# Brainstorming on Grimoire

In this file I describe the project I want to build, the electron app `Grimoire`.

About the name: A Grimoire is a spell book. This app is an AI Workflow manager/builder/runner/logger/analyzer. Similar to a Grimoire, it contains all the "spell and receipt" (workflow and such) to use the "magic" (ai).

The app run workflow by spawning claude code child with specific parameters etc..

## What problem it solves

Using AI with a CLI tool is one of the most powerful way to give agentic capability to one person, to run workflow on many different sort of work (coding, generating presentation, legal review, etc..).

However this tools are hard for non-technical.
Also it is hard to manage a library of prompt, workflow, duplicate them etc.. because everything is managed by files inside folder. There is no UI with capability.
Lastly, it is difficult to analyse and optimise workflow without a way to save them and collect data.

## What more it does

It can be entirely local. Files remain in the local folder of the user and run the user claude code app.
It allow to share workflow with people
It include feature like memory for agent
It include an agentic framework to build easily framework which will be integrated and monitored by the system
It allow to simply use claude code within the UI with a more visual return of what happen during usage (read agent conversation, view all details on tool usage, file creations, etc..)
etc..
It have a node system to visual the steps of a workflow and the possible conditional branches.
It allow to use claude code features, creates skills, agents etc.. however it creates it inside its own .claude folder, inside the electron app folder. This is intended to avoid messing up with the user ~/.claude folder.

Note: If not appropriate to have `dot-claude` inside the electron app folder, then we will use the computer folder designated for this usage and create the grimoire local data there. This technical details should be discussed later.

## About UI and features, etc..

There is not yet any documentation, this is the idea and everything about it is on this file for now. We will work on the features and UI by iteration, steps by steps.

## Work methodology

We will work by iteration. We document a MVP version, develop and test it, then we iterate features by features.

## How it integrates in the eco system

First made for personal usage, it can be used by non-technical, example a marketing staff who need to generate marketing canpaign. He could find a workflow public from the app, already prepared to use, or create its own and share with coworkers.

It can be use with N8N, as N8N provide connection and mean to run an AI but N8N does not provide anything about the workflow itself and creating a "workflow" in N8N is really not appropriate.

## Root Folder `./`

This is where is installed the electron app.

`./dot-claude`: is the folder where is located the global .claude files for the claude code instance spawned by the electron app. To do so, when spawn a claude code instance, it change the home directory into this folder. Every data saved by claude code system, when run by the app, will be saved and located here. The electron app can read this folder to gather information and use it for log, display, analyze, etc..

`./prototype`: a folder where user save dev-prototype during brainstorming.

## App UX Core elements

The APP have core element that are always displayed. It is largely inspired from Obsidian APP.

Those core element are panels and nav bar, ui element, that can change their content but always appears.

### Core Elements

The APP is divided in 4 main elements.

This is the exact same UX as Obsidian APP.

From left to right.

1. Ribbon, width enough to display a vertical list of icon to navigate trough main screen of the app (live, workflows, settings, ...)
2. Left Panel, width around 20-30%
    1. An horizontal bar at the very top can display icon for change the content of this panel. this panel have a button to hide the entire panel, only this button will remain them to display again the panel.
    2. A second horizontal bar, with middle aligned button to do action, related to the current content of the panel (sorting, new file, collapse, ..)
    3. The rest of the panel can be use to display various content, list of files, folder three, settings, etc..
3. Middle Panel, Main content width 60-70%, it can display many screen, from text file editor with tab system, node workflow builder with infinite canvas, live tchat with AI, etc..
4. Right Panel, exactly similar to Left Panel, with different contents.

## First Features for MVP

- Loading Screen: When the app open, display its logo and load what should be to improves performance and user experience.
    - Since the APP have to setup its own .claude, it should do some verification -> can it use claude, is it installed ? if no, alert the user with button to retry or close because it cant be use without claude usable
    - Once claude OK, is it connected already ? the app should remember about it, if never connected it will ask the user to run claude code via the APP to have the authentication flow and ensure the .claude of the app have the credentials.
    - It does any other verifications.

- CC Conversation Reader: Claude Code conversation reader simply put a visual interface to the user, that list all past session from claude code and we can click to view the conversation in a "tchat" interface but adapted to claude code conversation. In a first version it simply display the conversation with elegant bubble to distinct user, agents, sub agents.
    - On the left panel is displayed the list of session. When click one, it display it on middle panel with elegant bubble. on the right panel is a way to navigate the conversation. it display one rectangle for each message in the conversation. Clicking one scroll to that part. it also highlight the one visible on the screen. When too long, it scroll the list to follow the user scroll in the conversation. ( this feature have its own button on the very top bar of the panel )
    - On the left panel, another button "info" to display all info we can collect about this session from claude code ( creation time, etc.. anything in claude folder related to the session ). ( this feature have its own button on the very top bar of the panel )

# Request

Now that you have my project brainstorming, guide me on what to do, which workflow to start with on an empty project folder ?