const { Expo } = require('expo-server-sdk');
const expo = new Expo();
const express = require('express')
const bodyParser = require('body-parser')
const rp = require('request-promise')
const { check, validationResult } = require('express-validator/check');
const app = express()

const port = 8080

// create application/json parser
const jsonParser = bodyParser.json()

// Initialize firebase SDK
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://transparency-c26c5.firebaseio.com'
});


// Authentication Service
const auth = admin.auth();

// DB service
const db = admin.firestore();

/*
 * GET /chores
 * Returns JSON of all chores
 * TODO: setup based on tokens/uid
 */
app.get('/chores', (req, res) => {
    var groupId = req.query.groupID;
    var choresRef = db.collection("chores");
    var queryRef = choresRef.get().then(snapshot => {
        response = {}
        snapshot.forEach(doc => {
            if (groupId == doc.data().groupID) {
                response[doc.id] = doc.data();
            }
        });
        res.json(response);
    });
});

/*
 Gets the profile for the given uid.
 If the uid doesn't exist in collection, create it.
*/
function getProfile(uid) {
    // check to see if the uid is valid
    var displayName;
    var email;
    return admin.auth().getUser(uid)
      .then(userRecord => {
          // Now we check to see if the record exists in the profiles collection
          displayName = userRecord.displayName;
          email = userRecord.email;
          return db.collection('profiles').doc(uid).get()
      }).then(doc => {
          if (doc.exists) {
              // return the doc data as promise
              return db.collection('profiles').doc(uid).get()
          } else {
              // create the document
              console.log("creating user profile");
              return db.collection("profiles").doc(uid).set({
                  "total_chore_points": 0,
                  "uid": uid,
              })
          }
      }).then(ref => {
          var total_chore_points = ref.data().total_chore_points;
          // obtain data from ref and the userRecord
          return Promise.resolve({
              "displayName": displayName,
              "email": email,
              "total_chore_points": total_chore_points,
              "uid": uid
          });
      }).catch(function(error) {
        console.log("Error fetching user data:", error);
        throw error
      });
}

/*
 * Accepts an array of UIDs, and retrieves all of their profiles. Selects one at random
 * as a weighted probability of their chore points, and returns a promise of the uid of the user that
 * has been selected.
*/
function selectRandomUser(uids) {
    var promises = []
    for (let uid of uids) {
        promises.push(getProfile(uid))
    }
    return Promise.all(promises)
        .then(users => {
            var score_mappings = users.map(user => {
                return {"uid": user.uid, "total_chore_points": user.total_chore_points}
            })
            // TODO: weighted selection instead of just random
            var index = Math.floor(Math.random() * score_mappings.length);
            return Promise.resolve(score_mappings[index].uid);
        }).catch(errors => {
            console.log(errors);
            throw errors.errorInfo.message;
        });
}

/*
 * Endpoint that returns a random UID according to weights from passed UIDs
*/
app.post('/roulette', [
    jsonParser,
    check('uids').exists()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() })
    }
    if (!Array.isArray(req.body.uids)) {
        return res.status(422).json({"error": "uids must be an array"})
    }

    selectRandomUser(req.body.uids)
    .then(uid => {
        return res.status(200).json({"uid": uid});
    })
    .catch(error => {
        console.log(error);
        return res.status(422).json({"error": error})
    })
});

app.post('/profile', [
    jsonParser,
    check('uid').exists()
    ], (req,res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() })
        }
        getProfile(req.body.uid)
        .then(doc => {
            res.status(200).json(doc)
        }).catch(error => {
            console.log(error);
            res.status(400).json({"error": "uid does not exist."})
        })
});

/*
 * Creates chores associated with a given groupID
 */
app.post('/chores', [
    jsonParser,
    check('name').exists(),
    check('reward').exists(),
    check('num_chore_points').isNumeric(),
    check('groupID').exists(),
    check('assigned_to').exists(),
    ], (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() })
    }

    var groupsRef = db.collection('groups').doc(req.body.groupID);
    var members = [];
    var choreID;
    var displayName;
    groupsRef.get()
        .then(doc => {
            //validate that the assigned to is in the group
            if (doc.exists) {
                members = doc.data().members;
                if (!members.includes(req.body.assigned_to)) {
                    throw res.status(402).json({"reason": "assigned_to user is not in group!"})
                }
                return db.collection("chores").add({
                    "name": req.body.name,
                    "reward": req.body.reward,
                    "num_chore_points": Number(req.body.num_chore_points), // force to be a number
                    "assigned_to": req.body.assigned_to,
                    "isDone": false,
                    "groupID": req.body.groupID,
                })
            } else {
                throw res.status(402).json({"reason": "groupID does not exist!"});
            }
        }).then(ref => {
            choreID = ref.id;
            // Obtain the display name of the user that has just been assigned.
            return getProfile(req.body.assigned_to)
        }).then(user => {
            // notify all users of the group that we have created a new chore
            // and assigned it to a user
            return sendNotifications(members, "Chore added", user.displayName + " has been assigned a new chore: " + req.body.name);
        }).then(_ => {
            return res.status(200).json({"choreID": choreID});
        }).catch(error => {
            console.log(error);
        });
});

/*
 * Returns all chores associated with a particular user
 */
app.post('/assigned-chores', [
    jsonParser,
    check('uid').exists()
], (req,res) => {
    db.collection("chores").where("assigned_to", "==", req.body.uid).get()
    .then(snapshot => {
        response = {}
        snapshot.forEach(doc => {
            response[doc.id] = doc.data();
        })
        return res.status(200).json(response);
    })
})

/*
 * Returns all chores associated with a particular group
 */
app.post('/group-chores', [
    jsonParser,
    check('groupID').exists()
], (req, res) => {
    db.collection("chores").where("groupID", "==", req.body.groupID).get()
    .then(snapshot => {
        response = {}
        snapshot.forEach(doc => {
            response[doc.id] = doc.data();
        })
        return res.status(200).json(response);
    })
});

/*
 * Completes a chore.
*/
app.post('/chores/complete', [
    jsonParser,
    check('choreID').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var uid;
        var choreScore;
        var members = [];
        var groupID;
        var choreName;
        var displayName;
        return db.collection('chores').doc(req.body.choreID).get()
        .then(doc => {
            // check if chore exists
            if (!doc.exists) {
                throw res.status(404).json({"error": "choreID does not exist!"})
            }

            // check if isDone is already true
            if (doc.data().isDone == true) {throw res.status(422).json({"error": "Chore is already done!"})}
            choreScore = doc.data().num_chore_points;
            // get the uid of the user who was assigned to the chore.
            uid = doc.data().assigned_to
            groupID = doc.data().groupID
            choreName = doc.data().name
            // Increment the total chore points of the user's UID
            // First, the user's profile document
            return getProfile(uid)
        }).then(user => {
            var currentScore = user.total_chore_points
            currentScore += choreScore;
            // real name used for notification
            displayName = user.displayName;
            return db.collection('profiles').doc(uid).update("total_chore_points", currentScore)
        }).then(ref => {
            return db.collection('chores').doc(req.body.choreID).update("isDone", true);
        }).then(ref => {
            return db.collection('groups').doc(groupID).get()
        }).then(group => {
            members = group.data().members;
            // Now, let's notify all users in the group that we have finished the chores
            return sendNotifications(members, "Chore completed", displayName + " completed a chore: " + choreName);
        }).then(_ => {
            return res.status(200).json({"status": "successfully completed chore!"})
        }).catch(function(error) {
            console.log(error.body);
        });
});


/*
 * POST /devices
 * Registers a deviceID token for a particular uid
 * This deviceID token is used to send push notifications
 */
app.post('/devices', [
    jsonParser,
    check('uid').exists(),
    check('deviceToken').exists()
    ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    // obtain the document corresponding to the given uid
    var devices = [];

    var devicesRef = db.collection('devices').doc(req.body.uid)
    // delete token from any uid that does not include the current Array
    db.collection('devices').where('deviceTokens', 'array-contains', req.body.deviceToken).get()
    .then(snapshot => {
        var promises = [];
        snapshot.forEach(doc => {
            if (doc.id != req.body.uid) {
                var tokens = doc.data().deviceTokens;
                // delete this deviceToken from that device reference
                var filteredTokens = tokens.filter(token => {
                    return token != req.body.deviceToken;
                })
                var empty = [] // ensure that the array is at least empty
                promises.push(db.collection('devices').doc(doc.id).update('deviceTokens', empty.concat(filteredTokens)))
            }
        })
        return Promise.all(promises);
    }).then(_ => {
        return devicesRef.get();
    }).then(doc => {
            if (doc.exists) {
                // get the current document, and add to the deviceToken array
                var devices = doc.data().deviceTokens;
                if (devices.includes(req.body.deviceToken)) {
                    throw res.status(401).json({"reason": "token already registered"})
                } else {
                    devices.push(req.body.deviceToken);
                    // update the devices
                    return devicesRef.update("deviceTokens", devices);
                }
            } else {
                var devices = [req.body.deviceToken]
                return db.collection("devices").doc(req.body.uid).set({
                    'deviceTokens': devices
                });
            }
        }).then(ref => {
            console.log("Added Device with " + ref.id + "with token " + req.body.deviceToken);
            return res.status(200).json({
                id: ref.id,
                data: ref.data
            });
        }).catch( error => {
            console.log("Error" + error);
        });
});

/**
 * Endpoint for getting ALL of the groups.
 * Used for displaying the groups you can join
*/
app.get('/groups', (req, res) => {
    var groups = {}
    db.collection('groups').get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                groups[doc.id] = doc.data()
            })
            return res.status(200).json(groups)
        }).catch(error => {
            console.log(error);
            return res.status(400).json({"errors": "An error has occured."})
        })
});


/*
 * Endpoint for creating a group. Accepts a name, and the uid of the creator.
 * Returns 200 and groupID on success, 422 if the group alraedy exists.
*/
app.post('/group', [
    jsonParser,
    check('name').exists(),
    check('uid').exists(),
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var uid = req.body.uid;
        db.collection('groups').where("name", "==", req.body.name).get()
        .then((snapshot) => {
            let exists = false;
            snapshot.forEach(doc => {
                exists = true;
            });
            if (exists) {
                throw res.status(422).json({
                    "reason" : "The group already exists"
                });
            }

            return db.collection('groups').add({
                "name" : req.body.name,
                "uid" : uid,
                "members" : [uid]
            })
        }).then(ref => {
            return res.status(200).json({
                "groupID" : ref.id
            })
        }).catch(function(error) {
            console.log(error);
        });
});


/*
 * POST /assigned-groups
 * Returns groups associated with a particular user
 * Takes in a single paramter idToken, returns a JSON dictionary
 * mapping group ids to group objects
*/
app.post('/assigned-groups', [
    jsonParser,
    check('uid').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var groups = {}
        db.collection('groups').where("members", "array-contains", req.body.uid).get().then(snapshot => {
            snapshot.forEach(doc => {
                groups[doc.id] = doc.data();
            })
            return res.status(200).json(groups);
        }).catch(error => {
            console.log(error);
            return res.status(400).json({errors: "An error has occured."})
        });
});

/*
 * POST /group/add
 * Joins a given groupID with the passed UID
*/
app.post('/group/add', [
    jsonParser,
    check('groupID').exists(),
    check('uid').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var members = []
        var groupsRef = db.collection('groups').doc(req.body.groupID);
        groupsRef.get()
        .then(doc => {
                if (doc.exists) {
                    members = doc.data().members;
                } else {
                    throw res.status(401).json({"reason": "groupID not found."});
                }
                if (members.includes(req.body.uid)) {
                    throw res.status(401).json({"reason" : "member already exists in group"});
                }
                members.push(req.body.uid);
                return groupsRef.update("members", members)
        }).then(ref => {
            return res.status(200).json({"message" : "successfully joined group"});
        }).catch(error => {
            console.log(error);
        })
});

app.get('/tokens', (req, res) => {
    getDeviceTokens().then(tokens => {
        res.status(200).json(tokens);
    });
})

// Returns a Promise for a dictionary that maps from uid to deviceTokens,
// note that this is pretty inefficient with large amounts of users
function getDeviceTokens() {
    var devicesRef = db.collection("devices");
    var response = {};
    return devicesRef.get().then(snapshot => {
        snapshot.forEach(doc => {
            var deviceTokens = doc.data().deviceTokens;
            response[doc.id] = deviceTokens;
        })
        return Promise.resolve(response);
    })
}

// Sends a message for all deviceTokens associated
// with each uid. Note that notifications aren't sent for uids with no
// corresponding deviceTokens
function sendNotifications(uids, reqTitle, reqBody) {
    var promises = []
    var deviceTokens = {}
    //first obtain device tokens
    getDeviceTokens().then(dt => {
        deviceTokens = dt;
        // now we go through every uid, and attempt to send
        // push notification for each
        for (let uid of uids) {
            if (uid in deviceTokens) {
                for(token in deviceTokens[uid]) {
                    promises.push(
                        rp.post({
                          url: 'https://exp.host/--/api/v2/push/send',
                          headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                              to: deviceTokens[uid][token],
                              sound: 'default',
                              body: reqBody,
                              data: {body: reqBody, title: reqTitle}
                          })
                        })
                    )
                }
            }
        }
        return Promise.all(promises);
    })
}


app.listen(port, () => console.log(`Example app listening on port ${port}!`))
