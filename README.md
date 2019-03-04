# Chores
Currently Implemented Endpoints:

## GET /chores
Returns a JSON list of all chores.
## POST /chores
Creates a Chore. Requires a JSON body payload with the following
fields specified.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| name             | String    | yes       |             |
| reward           | String    | yes       |             |
| num_chore_points | Numeric   | yes       |             |
| assigned_to      | String    | yes       |             |
| priority         | Numeric   | yes       |             |
Returns 200 and the newly created chore-id if successful. Otherwise returns 422.
