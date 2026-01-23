---
description: 'Archive completed story artifacts and commit all changes in a single atomic operation. Can be invoked by sprint-runner or standalone with story IDs.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL @_bmad/core/tasks/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the specific workflow-config @_bmad/bmm/workflows/4-implementation/batch-commit/workflow.yaml
3. Pass the yaml path _bmad/bmm/workflows/4-implementation/batch-commit/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written to process and follow the specific workflow config and its instructions
5. Parse story_ids from command arguments (comma-separated list, e.g., "3a-1,3a-2")
</steps>
