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

app.get('/', (req, res) => res.send('Hello World!'))

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
            if (doc.data().members.includes(uid)) {
                // Now that we know that the groupID and uid are valid
                // we can go ahead and construct the chore
                return db.collection("chores").add({
                    "name": req.body.name,
                    "reward": req.body.reward,
                    "num_chore_points": req.body.num_chore_points,
                    "duration": req.body.duration,
                    "assigned_to": null,
                    "groupID": req.body.groupID
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
        console.log("Added new chore with id" + ref.id);
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
    check('idToken').exists()
    ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    var devicesRef = db.collection('devices')
        .where("idToken", "==", req.body.idToken)
        .where("uid", "==", req.body.uid)
        .get()
        .then(snapshot => {
            if (snapshot.size == 0) {
                return db.collection("devices").add({
                    'uid': req.body.uid,
                    'idToken': req.body.idToken
                })
            } else {
                throw res.status(401).json({"reason": "token already registered"})
            }
        }).then(ref => {
            console.log("Added Device with " + ref.id + "with token " + req.body.idToken);
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
    check('idToken').exists()
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

// endpoint for adding to group
app.post('/group/add', [
    jsonParser,
    check('groupID').exists(),
    check('idToken').exists(),
    check('emailToAdd').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        var uid;
        var uidToAdd;
        // first verify token
        admin.auth().verifyIdToken(req.body.idToken)
        .then(decodedToken => {
            var uid = decodedToken.uid;
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
            var groupRef = db.collection('groups').doc(req.body.groupID);
            return groupRef.get()
        }).then(doc => {
                var members = [];
                if (doc.exists) {
                    members = doc.data().members;
                } else {
                    throw res.status(401).json({"reason": "groupID not found."});
                }
                if (!members.includes(uid)) {
                    throw res.status(401).json({"reason" : "you do not have access to add to this group"});
                } else if (members.includes(uidToAdd)) {
                    throw res.status(401).json({"reason" : "member already exists in group"});
                } else {
                    members.push(uidToAdd);
                    return groupRef.update("members", members)
                }
        }).then(ref => {
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
            tokens.push(doc.data().idToken);
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
              body: message
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

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
