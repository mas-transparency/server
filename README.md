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

## POST /groups
Creates a Group. Requires a JSON body payload with the following fields specified

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| name             | String    | yes       |             |
| idToken           | String    | yes       |             |
Where `idToken` corresponds to the current user's authenticated firebase token.

Returns the groupID of the current group

## POST /groups/add
Adds a user to a group. Requires a JSON body payload with the following fields.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| groupID             | String    | yes       |             |
| idToken           | String    | yes       |             |
| emailToAdd           | String    | yes       |             |
Where `emailToAdd` is the associated Firebase user

## POST /assigned-groups
Gets all groups associated with the current authenticated user. Requires JSON
body payload with the following fields specified

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| idToken          | String    | yes       |             |

Where `idToken` corresponds the current user's authenticated firebase token.

The API will return a JSON dictionary mapping group-ids to members in the following format. Here is an example output:
```
  "2SJMLt8czYtXnd4tNQnv": {
       "name": "Cali summer intern",
       "uid": "YFBkoLUNwwQLdbbO8o4aOAA88TQ2",
       "members": [
           "YFBkoLUNwwQLdbbO8o4aOAA88TQ2"
       ]
   },
   "EmblaLZoAR1qg7D6xmvN": {
       "uid": "YFBkoLUNwwQLdbbO8o4aOAA88TQ2",
       "members": [
           "YFBkoLUNwwQLdbbO8o4aOAA88TQ2"
       ],
       "name": "Zbar 101"
   }
```

## POST /devices
Registers a deviceID token for a particular uid. Used to send push notifications.
| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| idToken          | String    | yes       |             |
