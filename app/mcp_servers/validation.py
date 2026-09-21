import math
from typing import Dict, Any


class ValidationServer:
    """Validate analysis results"""

    @staticmethod
    def validate_numeric(value: float) -> Dict[str, Any]:
        issues = []
        if math.isnan(value):
            issues.append("Value is NaN")
        elif math.isinf(value):
            issues.append("Value is Inf")
        elif value < -1e10:
            issues.append("Value is suspiciously large negative")

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "value": value if len(issues) == 0 else None
        }

    @staticmethod
    def validate_results(results: Dict[str, Any]) -> Dict[str, Any]:
        issues = []
        for key, val in results.items():
            if isinstance(val, float):
                if math.isnan(val) or math.isinf(val):
                    issues.append(f"'{key}' is NaN or Inf")
        return {"valid": len(issues) == 0, "issues": issues}
