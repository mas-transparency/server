# Chores
Currently Implemented Endpoints:

## GET /chores?groupID=exampleGroupID
Returns a JSON list of all chores associated with a groupID

## GET /users?groupID=exampleGroupID
Returns a JSON list of all users associated with a groupID

## GET /assignedChores?groupID=exampleGroupID&idToken=exampleIdToken
Returns a JSON list of all assignedChoers associated with a groupID and idToken. We've been using idToken=1234 to bypass checking with Google. If you
do this, you will want to pass in a uid=exampleUid. Otherwise, you can just use an actual idToken.

## POST /completedChore
Creates a Chore. Requires a JSON body payload with the following
fields specified.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| choreId             | String    | yes       |             |
| idToken          | String    | yes       |             |

Returns 200 and the newly created chore-id if successful. Otherwise returns 422.

## POST /chores
Creates a Chore. Requires a JSON body payload with the following
fields specified.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| name             | String    | yes       |             |
| reward           | String    | yes       |             |
| num_chore_points | Numeric   | yes       |             |
| duration | Numeric   | yes       |             |
| idToken      | String    | yes       |             |
| groupID      | String    | yes       |             |
Returns 200 and the newly created chore-id if successful. Otherwise returns 422.

## POST /chores/edit
Edits a chore. Requires a JSON body payload with the following fields specified.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| name             | String    | yes       |             |
| reward           | String    | yes       |             |
| num_chore_points | Numeric   | yes       |             |
| duration | Numeric   | yes       |             |
| assigned_to | String | yes       |             |
| idToken      | String    | yes       |             |
| groupID      | String    | yes       |             |
| choreID      | String    | yes       |             |

## POST /chores/delete
Deletes a chore. Requires a JSON body payload with the following fields specified.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| idToken      | String    | yes       |             |
| choreID      | String    | yes       |             |

## GET /groups
Returns all groups. Used for browsing groups.
Returns same output format as /assigned-groups

## POST /group
Creates a Group. Requires a JSON body payload with the following fields specified

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| name             | String    | yes       |             |
| uid           | String    | yes       |             |
Where `uid` corresponds to the current user's UID.

Returns the groupID of the current group

## POST /groups/add
Joins a group.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| groupID             | String    | yes       |             |
| uid           | String    | yes       |             |

## POST /assigned-groups
Gets all groups associated with the current authenticated user. Requires JSON
body payload with the following fields specified

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| uid          | String    | yes       |             |

Where `uid` corresponds the current user's uid.

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
