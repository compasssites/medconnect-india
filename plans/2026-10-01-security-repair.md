# Dependency security repair

Prepared and verified in an isolated checkout, preserving existing local work. Clean installation completed. The shipping helper runs the project check/build before committing and pushing. No database schema or production bindings changed. Deployment follows the existing project workflow; a push alone does not deploy manually managed Workers.

Audit evidence:

```json
[
  {
    "unit": ".",
    "metadata": {
      "vulnerabilities": {
        "info": 0,
        "low": 0,
        "moderate": 4,
        "high": 0,
        "critical": 0,
        "total": 4
      },
      "dependencies": {
        "prod": 282,
        "dev": 96,
        "optional": 243,
        "peer": 0,
        "peerOptional": 0,
        "total": 543
      }
    },
    "error": null
  }
]
```
