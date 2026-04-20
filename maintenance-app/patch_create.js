const fs = require('fs');
const file = './src/views/work-orders/create/view.js';
let content = fs.readFileSync(file, 'utf8');

// Add cleanupFns array
content = content.replace(/let attachedFiles = \[\];/, 'let attachedFiles = [];\nlet cleanupFns = [];');

// initTypeCards
content = content.replace(
    /card\.addEventListener\("click", \(\) => \{([\s\S]*?)\}\);/g,
    `const onClick = () => {$1};
            card.addEventListener("click", onClick);
            cleanupFns.push(() => card.removeEventListener("click", onClick));`
);

// initPriorityPills (same shape as above, so the previous replace handles it if we do it right, but let's be careful. Actually wait, they use the exact same signature. Let's just do a specific replace).
