# Chores
Currently Implemented Endpoints:

## GET /chores?groupID=exampleGroupID
Returns a JSON list of all chores associated with a groupID

## GET /users?groupID=exampleGroupID
Returns a JSON list of all users associated with a groupID

## GET /assignedChores?groupID=exampleGroupID&idToken=exampleIdToken
Returns a JSON list of all assignedChoers associated with a groupID and idToken. We've been using idToken=1234 to bypass checking with Google. If you
do this, you will want to pass in a uid=exampleUid. Otherwise, you can just use an actual idToken.

## POST /profile
Retrieves the profile including the displayName, email, and total chore points of a uid

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| uid           | String    | yes       |             |

## POST /chores
Creates a Chore. Requires a JSON body payload with the following
fields specified.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| name             | String    | yes       |             |
| reward           | String    | yes       |             |
| num_chore_points | Numeric   | yes       |             |
| assigned_to      | String    | yes       |             |
| groupID      | String    | yes       |             |

assigned_to corresponds to the uid of the user to assign to.
Returns 200 and the newly created chore-id if successful. Otherwise returns 422.

## POST /chores/complete
Completes a chore. Requires a JSON body payload with the following
fields specified.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| choreId             | String    | yes       |             |

Returns 200 and the newly created chore-id if successful. Otherwise returns 422.

## POST /group-feed

Gets the most recent ten chores completed by a particular group.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| groupId             | String    | yes       |             |

Example output:

```
[
    {
        "modifiedTime": {
            "_seconds": 1555305095,
            "_nanoseconds": 105000000
        },
        "groupID": "IEBLr1oChKqpRBBxuRf6",
        "isDone": true,
        "num_chore_points": 10,
        "reward": "one_dollar",
        "assigned_to": "WdehdYJfS8YQ3LzwxqlSALPtFza2",
        "name": "Do Dishes",
        "id": "F2ilDFBEJIvcQ8jZaOTc"
    },
    {
        "modifiedTime": {
            "_seconds": 1555304827,
            "_nanoseconds": 505000000
        },
        "groupID": "IEBLr1oChKqpRBBxuRf6",
        "isDone": true,
        "num_chore_points": 10,
        "reward": "one_dollar",
        "assigned_to": "WdehdYJfS8YQ3LzwxqlSALPtFza2",
        "name": "Do Dishes",
        "id": "XnKQtm7mzKIFNx7WMNZO"
    }
]
```

## POST /assigned-chores
Returns all chores associated with a particular uid.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| uid             | String    | yes       |             |

## POST /group-chores
Returns all chores associated with a particular groupID

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| groupID             | String    | yes       |             |

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
| uid          | String    | yes       |             |
| deviceToken          | String    | yes       |             |   |  
## POST /roulette
Returns a uid from a groupID accoring to a random weighted algorithm.

| field            | data type | required? | Description |
|------------------|-----------|-----------|-------------|
| groupID          | String    | yes       |             |
