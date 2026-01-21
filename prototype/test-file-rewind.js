#!/usr/bin/env node
/**
 * Test file rewind with hybrid session
 *
 * Flow:
 * 1. Create a file with content "ORIGINAL"
 * 2. Ask Claude to change it to "MODIFIED"
 * 3. Rewind to checkpoint 1 (with file rewind)
 * 4. Verify file is back to "ORIGINAL"
 */

const { GrimoireSession } = require('./hybrid-session')
const path = require('path')
const fs = require('fs')

async function collectMessages(generator) {
  const messages = []
  for await (const msg of generator) {
    messages.push(msg)
  }
  return messages
}

function getResultText(messages) {
  const result = messages.find((m) => m.type === 'result')
  return result?.result || ''
}

async function main() {
  console.log('='.repeat(60))
  console.log('GRIMOIRE FILE REWIND TEST')
  console.log('='.repeat(60))

  const testDir = path.join(__dirname, 'test-workspace')
  const testFile = path.join(testDir, 'rewind-test.txt')

  // Setup
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }

  const session = new GrimoireSession({
    cwd: testDir,
    debug: true
  })

  try {
    // Step 1: Create initial file
    console.log('\n--- STEP 1: Create file with ORIGINAL ---')
    fs.writeFileSync(testFile, 'ORIGINAL')
    console.log('File content:', fs.readFileSync(testFile, 'utf8'))

    // Step 2: First message - just establish session
    console.log('\n--- STEP 2: Establish session ---')
    let messages = await collectMessages(
      session.sendMessage(
        'I created a file called rewind-test.txt with content "ORIGINAL". Acknowledge this.'
      )
    )
    console.log('Response:', getResultText(messages))
    const checkpoint1 = session.getRewindPoints()[0]?.uuid
    console.log('Checkpoint 1:', checkpoint1)

    // Step 3: Ask Claude to modify the file
    console.log('\n--- STEP 3: Modify file to MODIFIED ---')
    messages = await collectMessages(
      session.sendMessage(
        'Use the Write tool to change rewind-test.txt content to just "MODIFIED" (nothing else).'
      )
    )
    console.log('Response:', getResultText(messages))
    console.log('File content after edit:', fs.readFileSync(testFile, 'utf8'))

    // Step 4: Rewind with file restore
    console.log('\n--- STEP 4: REWIND with file restore ---')
    await session.rewind(checkpoint1, { rewindFiles: true, fork: true })

    // Check file content
    const fileAfterRewind = fs.readFileSync(testFile, 'utf8')
    console.log('File content after rewind:', fileAfterRewind)

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    console.log('File rewind:', fileAfterRewind === 'ORIGINAL' ? 'SUCCESS' : 'FAIL')
    console.log('Expected: ORIGINAL')
    console.log('Got:', fileAfterRewind)
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

main()
