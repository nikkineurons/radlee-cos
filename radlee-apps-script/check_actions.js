const fs = require('fs');

const code = fs.readFileSync('Code.gs', 'utf8');

// Extract ACTION_REGISTRY
const registryMatch = code.match(/const ACTION_REGISTRY = (\{[\s\S]*?\n\});/);
if (!registryMatch) {
  console.log("Could not find ACTION_REGISTRY");
  process.exit(1);
}

let registry;
try {
  eval("registry = " + registryMatch[1]);
} catch(e) {
  console.log("Error evaling registry", e);
  process.exit(1);
}

// Extract handleStructuredRouting cases
const handleMatch = code.match(/function handleStructuredRouting[\s\S]*?^}/m);
if (!handleMatch) {
  console.log("Could not find handleStructuredRouting");
  process.exit(1);
}
const handleCode = handleMatch[0];

const cases = [...handleCode.matchAll(/case "([^"]+)":/g)].map(m => m[1]);

console.log("=== Actions in Registry ===");
const regActions = Object.keys(registry).filter(a => a !== "NONE");
console.log(regActions);

console.log("\n=== Actions in handleStructuredRouting ===");
console.log(cases);

console.log("\n=== Inconsistencies ===");
const missingInHandle = regActions.filter(a => !cases.includes(a));
const missingInRegistry = cases.filter(a => !regActions.includes(a) && a !== "NONE");

if (missingInHandle.length > 0) {
  console.log("Actions in Registry but missing in handleStructuredRouting:", missingInHandle);
} else {
  console.log("No actions missing in handleStructuredRouting.");
}

if (missingInRegistry.length > 0) {
  console.log("Cases in handleStructuredRouting but missing in Registry:", missingInRegistry);
} else {
  console.log("No cases missing in Registry.");
}

// Also check required params in handleStructuredRouting matches registry
console.log("\n=== Parameter Check ===");
let paramInconsistencies = false;
regActions.forEach(action => {
  const meta = registry[action];
  const params = meta.params;
  if (!cases.includes(action)) return;
  
  // get the code block for this case
  const caseRegex = new RegExp(`case "${action}":([\\s\\S]*?)(?:case "|$)`);
  const caseMatch = handleCode.match(caseRegex);
  if (caseMatch) {
    const caseBlock = caseMatch[1];
    const requireParamMatches = [...caseBlock.matchAll(/requireParam\("([^"]+)"\)/g)].map(m => m[1]);
    
    // compare
    const expected = [...params].sort();
    const actual = [...requireParamMatches].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      console.log(`Action ${action} mismatch! Registry says: ${expected}, but code requires: ${actual}`);
      paramInconsistencies = true;
    }
  }
});

if (!paramInconsistencies) {
  console.log("All parameters match between Registry and handleStructuredRouting.");
}

