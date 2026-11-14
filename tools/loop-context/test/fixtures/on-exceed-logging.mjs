let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
  const decision = JSON.parse(data);
  if (!decision.escalate || decision.trigger !== 'stagnation') {
    throw new Error('Expected the escalation decision on stdin.');
  }
  console.log(`Hook notified after ${decision.trigger}`);
  console.error('Hook stderr diagnostic');
  process.exitCode = Number(process.argv[2] ?? 0);
});
