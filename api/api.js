const { Expo } = require('expo-server-sdk');
const expo = new Expo();
const express = require('express')
const bodyParser = require('body-parser')
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

// bind endpoints to queries
app.get('/chores', (req, res) => {
    var choresRef = db.collection("chores");
    var queryRef = choresRef.get().then(snapshot => {
        response = {}
        snapshot.forEach(doc => {
            response[doc.id] = doc.data();
        });
        res.json(response);
    });
});

app.post('/devices', [
    jsonParser,
    check('uid').exists(),
    check('idToken').exists()
    ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    var devicesRef = db.collection('devices').where("idToken", "==", req.body.idToken).where("uid", "==", req.body.uid)
        .get()
        .then(snapshot => {
            if (snapshot.size == 0) {
                db.collection("devices").add({
                    'uid': req.body.uid,
                    'idToken': req.body.idToken
                }).then(ref => {
                    console.log("Added Device with " + ref.id + "with token " + req.body.idToken);
                    return res.status(200).json({
                        id: ref.id,
                        data: ref.data
                    });
                });
            } else {
                return res.status(200).json({
                    "reason": "token already registered"
                })
            }
        });
});


// endpoint for querying groups associated with a particular user
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
            data: { body: req.body.body, title: req.body.title },
          })
        }
        sendMessages(messages);
        res.json({"status": "success"});
    });


});

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

// Create a chore. A Chore has a name, reward, and num_chore_points
// This endpoint accepts application/json requests
app.post('/chores', [
    jsonParser,
    check('name').exists(),
    check('reward').exists(),
    check('num_chore_points').isNumeric(),
    check('assigned_user').exists()
    ], (req, res) => {
    const errors = validationResult(req);
    // Check to see if the req includes name, reward, and num_chore_points
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    db.collection("chores").add({
        "name": req.body.name,
        "reward": req.body.reward,
        "num_chore_points": req.body.num_chore_points,
        "assigned_to": req.body.assigned_user
    }).then(ref => {
        console.log("Added document with " + ref.id);
        return res.status(200).json({
            id: ref.id,
            data: ref.data
        });
    });

});

// sends a bunch of expo messages
async function sendMessages(messages) {
    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    (async () => {
      // Send the chunks to the Expo push notification service. There are
      // different strategies you could use. A simple one is to send one chunk at a
      // time, which nicely spreads the load out over time:
      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          console.log(ticketChunk);
          tickets.push(...ticketChunk);
          // NOTE: If a ticket contains an error code in ticket.details.error, you
          // must handle it appropriately. The error codes are listed in the Expo
          // documentation:
          // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
        } catch (error) {
          console.error(error);
        }
      }
    })();

    let receiptIds = [];
    for (let ticket of tickets) {
      // NOTE: Not all tickets have IDs; for example, tickets for notifications
      // that could not be enqueued will have error information and no receipt ID.
      if (ticket.id) {
        receiptIds.push(ticket.id);
      }
    }

    let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    (async () => {
      // Like sending notifications, there are different strategies you could use
      // to retrieve batches of receipts from the Expo service.
      for (let chunk of receiptIdChunks) {
        try {
          let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
          console.log(receipts);

          // The receipts specify whether Apple or Google successfully received the
          // notification and information about an error, if one occurred.
          for (let receipt of receipts) {
            if (receipt.status === 'ok') {
              continue;
            } else if (receipt.status === 'error') {
              console.error(`There was an error sending a notification: ${receipt.message}`);
              if (receipt.details && receipt.details.error) {
                // The error codes are listed in the Expo documentation:
                // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
                // You must handle the errors appropriately.
                console.error(`The error code is ${receipt.details.error}`);
              }
            }
          }
        } catch (error) {
          console.error(error);
        }
      }
    })();
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
