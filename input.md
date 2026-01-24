1.1. No, there is a specific claude code flat to append. The --prompt-system erase claude code system prompt, we dont want this. I believe its --prompt-system-append

1.2. end of the prompt system, after the commands workflow is injected. yes add a rule attribute

2.1. a, keep this sprint-runner as a standalone

2.2. They follow the BMAD workflow structure, however we compute everything and inject it into the prompt system, all that is possible, dynamically, when spawn the sug-agent. this is what come first in the prompt system we append.

3.1. b

3.2. story IDs

4.1. we dont search specific keyword such as discovery-story. Blindly find all file with a matching story id in its name. move it.

5.1. I dont know any BMAD commands `/bmad:bmm:workflows:batch-commit` if not exist we create a dedicated one, we use the same principle for all custom command we created, we name it sprint-commit

6.1 All, because we will manipulate steps for all (discovery-project, inject project-context etc..) so we want to control and edit the steps of anyworkflow without modifying the original BMAD system, this prevent error if any BMAD update is made. Example for the create-story, reviews etc.. we created custom rules in the current version of the command and we pass it as first prompt when lunching the agents. Those rules are not in the command itself and append to the prompt system of the agent.

7.1. a

8.1. a

9.1. a -> I want to add somethign. I instructed that the script will scan for all files with the story IDs in the name and inject it into the list of injected files. It should avoid to inject the same file twice, before generating the injection, we list all files and keep remove duplicated entry. Because the step of injecting the discovery-story will inject the same file included in the one that scan for story IDs, we still keep the 2 process for solidity.

---

Please take note, for all existing command we use in BMAD (create-story, create-tech-spec, etc..) We duplicate the folder of this command with a prefix `sprint-` and then we make this folder out custom command that we can edit, to adapt our script and manipulate. If a command in BMAD does not exist, such as sprint-commit, we create it, duplicating the style of other existing command and matching the need for our script.