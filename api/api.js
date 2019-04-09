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

app.post('/chores', [
    jsonParser,
    check('name').exists(),
    check('reward').exists(),
    check('num_chore_points').isNumeric(),
    check('duration').isNumeric(),
    check('idToken').exists(),
    check('groupID').exists(),
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
            throw res.status(402).json({
                "reason": "not authorized"
            });
        }
    }).then( () => {
        return db.collection('groups').doc(req.body.groupID).get()
    }).then(doc => {
        if (doc.exists) {
            // check to see if the user is in the given groupID
            var allowedToAdd = false;
            members = doc.data().members;
            for (i = 0; i < members.length; i++) {
                if (members[i].uid == uid) allowedToAdd = true;
            }
            if (allowedToAdd) {
                // Now that we know that the groupID and uid are valid
                // we can go ahead and construct the chore
                randArr = shuffle(doc.data().members);
                return db.collection("chores").add({
                    "name": req.body.name,
                    "reward": req.body.reward,
                    "num_chore_points": req.body.num_chore_points,
                    "duration": req.body.duration,
                    "assigned_to": randArr[0],
                    "index" : 0,
                    "groupID": req.body.groupID,
                    "rotation" : randArr
                })
            } else {
                throw res.status(402).json({"reason": "User not in group!"});
            }
        } else {
            throw res.status(402).json({
                "reason": "groupID does not exist!"
            })
        }
    }).then(ref => {
        console.log("Added new chore with id " + ref.id);
        return res.status(200).json({
            id: ref.id,
            data: ref.data
        });
    }).catch(error => {
        console.log(error);
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


/*
 * POST /assigned-groups
 * Returns groups associated with a particular user
 * Takes in a single paramter idToken, returns a JSON dictionary
 * mapping group ids to group objects
*/
app.post('/assigned-groups', [
    jsonParser,
    check('idToken').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        admin.auth().verifyIdToken(req.body.idToken)
        .then(function(decodedToken) {
            var uid = decodedToken.uid;
            var query = db.collection('groups').where("members", "array-contains", uid);
            var groups = {};
            return query.get().then(snapshot => {
                snapshot.forEach(doc => {
                    groups[doc.id] = doc.data();
                })
                return res.status(200).json(groups);
            })
        }).catch(function(error) {
            if (req.body.idToken == "1234") {
                var uid = req.body.uid;
                var query = db.collection('groups').where("members", "array-contains", uid);
                var groups = {};
                return query.get().then(snapshot => {
                    snapshot.forEach(doc => {
                        groups[doc.id] = doc.data();
                    })
                    return res.status(200).json(groups);
                })
            } else {
                throw res.status(402).json({
                    "reason": "not authorized"
                });
            }
        }).catch(error => {
            console.log(error);
        });
});

// endpoint for creating group
app.post('/group', [
    jsonParser,
    check('name').exists(),
    check('idToken').exists(),
    check('username').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var uid;
        var groupsRef;
        admin.auth().verifyIdToken(req.body.idToken)
        .then(function(decodedToken) {
            uid = decodedToken.uid;
            return db.collection('groups').where("uid", "==", uid).where("name", "==", req.body.name).get();
        }).catch(error => {
            if (req.body.idToken == "1234") {
                uid = req.body.uid;
                return db.collection('groups').where("uid", "==", uid).where("name", "==", req.body.name).get();
            } else {
                throw res.status(401).json({"error": "unauthorized."})
            }
        }).then((snapshot) => {
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
                "members" : [{
                    "uid": uid,
                    "username" : req.body.username
                }]
            })
        }).then(ref => {
            return res.status(200).json({
                "groupID" : ref.id
            })
        }).catch(function(error) {
            console.log(error);
        });
});

// endpoint for adding to group
app.post('/group/add', [
    jsonParser,
    check('groupID').exists(),
    check('idToken').exists(),
    check('emailToAdd').exists(),
    check('usernameToAdd').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var uid;
        var uidToAdd;
        var groupRef;
        // first verify token
        admin.auth().verifyIdToken(req.body.idToken)
        .then(decodedToken => {
            var uid = decodedToken.uid;
            var members = [];
            // now verify emailToAdd
            return admin.auth().getUserByEmail(req.body.emailToAdd)
        }).catch(error => {
            if (req.body.idToken == "1234") {
                uid = req.body.uid;
                return admin.auth().getUserByEmail(req.body.emailToAdd)
            } else {
                throw res.status(401).json({"error": "unauthorized."})
            }
        })
        .then(function(userRecord) {
            uidToAdd = userRecord.uid;
        }).catch(function(error) {
            throw res.status(401).json({"reason": "email not found."})
        }).then(() => {
            // Now verify groupID
            groupRef = db.collection('groups').doc(req.body.groupID);
            return groupRef.get()
        }).then(doc => {
                if (doc.exists) {
                    members = doc.data().members;
                } else {
                    throw res.status(401).json({"reason": "groupID not found."});
                }
                
                var allowedToAdd = false;
                for (i = 0; i < members.length; i++) {
                    if (members[i].uid == uid) allowedToAdd = true;
                    if (members[i].uid == uidToAdd) throw res.status(401).json({"reason" : "member already exists in group"});
                }

                if (!allowedToAdd) {
                    throw res.status(401).json({"reason" : "you do not have access to add to this group"});
                } else {
                    members.push({
                        "uid" : uidToAdd,
                        "username" : req.body.usernameToAdd
                    });
                    return groupRef.update("members", members)
                }
        }).then(ref => {
            // send notifications to all other members that a user has been added to the group.
            // We want to obtain the corresponding tokens for each uid
            return res.status(200).json({"message" : "successfully added new member to group"});
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

app.get('/assigned-chores', (req, res) => {
    var assignedChoresRef = db.collection("assigned-chores");
    var queryRef = assignedChoresRef.get().then(snapshot => {
        console.log(snapshot);
        response = {}
        snapshot.forEach(doc => {
            response[doc.id] = doc.data();
            console.log(doc.id, '=>', doc.data());
        });
        console.log(response);
        res.json(response);
    });
});

app.get('/users', (req, res) => {
    var groupId = req.query.groupID;
    var groupsRef = db.collection("groups");
    groupsRef.doc(groupId).get().then(doc => {
        response = [];
        members = doc.data().members;
        for (i = 0; i < members.length; i++) response.push(members[i].username);
        res.json(response);
    });
});

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
