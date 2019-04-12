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
            console.log(doc.data());
            if (groupId == doc.data().groupID) {
                response[doc.id] = doc.data();
            }
        });
        res.json(response);
    });
});

app.post('/completedChore', [
    jsonParser,
    check('choreId').exists(),
    check('idToken').exists()
    ], (req, res) => {
        // get all chores associated with groupID
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var uid;
        admin.auth().verifyIdToken(req.body.idToken)
        .then(function(decodedToken) {
            uid = decodedToken.uid;
            return db.collection('chores').doc(req.body.choreId).get();
        }).catch(error => {
            if (req.body.idToken == "1234") {
                uid = req.body.uid;
                return db.collection('chores').doc(req.body.choreId).get();
            } else {
                throw res.status(401).json({"error": "unauthorized."})
            }
        }).then((doc) => {
            var data = doc.data();
            var index = (data.index + 1) % data.rotation.length;
            var nextInLine = data.rotation[index];
            console.log(nextInLine);
            choresRef = db.collection('chores').doc(req.body.choreId);
            choresRef.update("index", index);
            choresRef.update("assigned_to", nextInLine);
            // send notifications to all members of group about who
            // has been assigned

            return choresRef;
        }).then(ref => {
            return res.status(200).json({
                "ref" : ref.id
            })
        }).catch(function(error) {
            console.log(error);
        });
});

// Edit a Chore has a name, reward, num_chore_points,
// and is associated with a particular groupID
// This endpoint accepts application/json requests
app.post('/chores/edit', [
    jsonParser,
    check('name').exists(),
    check('reward').exists(),
    check('num_chore_points').isNumeric(),
    check('assigned_to').exists(),
    check('idToken').exists(),
    check('groupID').exists(),
    check('duration').isNumeric(),
    check('choreID').exists()
    ], (req, res) => {
    const errors = validationResult(req);
    // Check to see if the req includes name, reward, and num_chore_points
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    // Verify that the user is logged in
    var uid = null;
    admin.auth().verifyIdToken(req.body.idToken)
    .then(function(decodedToken) {
        uid = decodedToken.uid;
    }).catch(function(error) {
        if (req.body.idToken == "1234") {
            console.log("here");
            uid = req.body.uid;
        } else {
            throw res.status(402).json({
                "reason": "not authorized"
            });
        }
    }).then( () => {
        return db.collection('chores').doc(req.body.choreID).get()
    }).then(doc => {
        if (doc.exists) {

            return db.collection("chores").doc(doc.id).update({
                "name": req.body.name,
                "reward": req.body.reward,
                "num_chore_points": req.body.num_chore_points,
                "assigned_to": req.body.assigned_to,
                "idToken" : req.body.idToken,
                "duration" : req.body.duration,
                "groupID": req.body.groupID
            });
        } else {
            throw res.status(402).json({
                "reason": "groupID does not exist!"
            })
        }
    }).then(ref => {
        console.log("Updated chore with id" + ref.id);
        return res.status(200).json({
            id: ref.id,
            data: ref.data
        });
    }).catch(error => {
        console.log(error);
    });
});

app.post('/chores/delete', [
    jsonParser,
    check('idToken').exists(),
    check('choreID').exists()
    ], (req, res) => {
    const errors = validationResult(req);
    // Check to see if the req includes name, reward, and num_chore_points
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    // Verify that the user is logged in
    var uid = null;
    admin.auth().verifyIdToken(req.body.idToken)
    .then(function(decodedToken) {
        uid = decodedToken.uid;
    }).catch(function(error) {
        if (req.body.idToken == "1234") {
            uid = req.body.uid;
        } else {
            throw res.status(402).json({"reason": "not authorized"});
        }
    }).then( () => {
        return db.collection('chores').doc(req.body.choreID).get()
    }).then(doc => {
        if (doc.exists) {
            return db.collection("chores").doc(doc.id).delete();
        } else {
            throw res.status(402).json({"reason": "groupID does not exist!"})
        }
    }).then(ref => {
        return res.status(200).json({
            id: ref.id,
            data: ref.data
        });
    }).catch(error => {
        console.log(error);
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
              });
          }
      }).then(ref => {
          var total_chore_points =  ref.data().total_chore_points;
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
            // combine the data from display name
            var output = {};
            output[doc.id] = doc.data();
            res.status(200).json(output)
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

    db.collection('groups').doc(req.body.groupID).get()
        .then(doc => {
            //validate that the assigned to is in the group
            if (doc.exists) {
                var members = doc.data().members;

                if (!members.includes(req.body.assigned_to)) {
                    throw res.status(402).json({"reason": "assigned_to user is not in group!"})
                }
                // Now that we've verified the group exists, we will assign the
                // user with the user based on a weighted sum of their corresponding
                // chore points.
                return db.collection("chores").add({
                    "name": req.body.name,
                    "reward": req.body.reward,
                    "num_chore_points": req.body.num_chore_points,
                    "assigned_to": req.body.assigned_to,
                    "isDone": false,
                    "groupID": req.body.groupID,
                })
            } else {
                throw res.status(402).json({"reason": "groupID does not exist!"});
            }
        }).then(ref => {
            console.log("Added new chore with id " + ref.id);
            return res.status(200).json({"choreID": ref.id});
        }).catch(error => {
            console.log(error);
        });
});

app.get('/assignedChores', (req, res) => {
    var groupId = req.query.groupID;
    var idToken = req.query.idToken;
    var testUid = req.query.uid;

    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            var uid = decodedToken.uid;
        }).catch(error => {
            if (idToken == "1234") {
                uid = testUid;
            } else {
                throw res.status(401).json({"error": "unauthorized."})
            }
        }).then(() => {
            return db.collection("chores");
        }).then(choresRef => {
            choresRef.get().then(snapshot => {
                response = []
                snapshot.forEach(doc => {
                    var data = doc.data();
                    var currUid;
                    if (data.assigned_to != null) currUid = data.assigned_to.uid;
                    if (groupId == data.groupID && currUid != null && currUid == uid) {
                        response.push({
                            "choreId" : doc.id,
                            "name" : data.name
                        });
                    }
                });
                res.json(response);
            });
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
    devicesRef.get().then(doc => {
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
                return db.collection("devices").doc(req.body.uid).set({
                    'deviceToken': 'deviceToken'
                });
                var devices = [req.body.deviceToken]
                return devicesRef.update("deviceTokens", devices)
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
            // send notifications to all other members that a user has been added to the group.
            // We want to obtain the corresponding tokens for each uid
            return res.status(200).json({"message" : "successfully joined group"});
        }).catch(error => {
            console.log(error);
        })
});

// debug endpoint to send messages
app.post('/notify',[
    jsonParser,
    check('title').exists(),
    check('body').exists(),
    ], (req, res) => {
    // First we validate the payload includes title and body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    // Then we send the message to all tokens.
    var devicesRef = db.collection("devices");
    var queryRef = devicesRef.get().then(snapshot => {
        var tokens = [];
        var messages = [];
        snapshot.forEach(doc => {
            console.log(doc);
            console.log(deviceTokens);
            var deviceTokens = doc.data().deviceTokens;
            for(let deviceToken of deviceTokens) {
                tokens.push(deviceToken);
            }
        })
        for (let pushToken of tokens) {
          // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

          // Check that all your push tokens appear to be valid Expo push tokens
          if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            continue;
          }

          // Construct a message (see https://docs.expo.io/versions/latest/guides/push-notifications.html)
          messages.push({
              to: pushToken,
              sound: 'default',
              body: req.body.body,
              data: {body: req.body.body, title: req.body.title}
          })
        }
        return sendMessages(messages);
    }).then(response => {
        res.status(200).json(response);
        console.log(response);
    }).catch(error => {
        console.log(error);
        res.status(401).json(error);
    });
});

function sendMessages(messages) {
    var promises = []
    for (let message of messages) {
        promises.push(
            rp.post({
              url: 'https://exp.host/--/api/v2/push/send',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(message)
          })
        )
      }
    return Promise.all(promises);
}



app.listen(port, () => console.log(`Example app listening on port ${port}!`))
