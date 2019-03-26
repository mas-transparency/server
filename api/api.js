const { Expo } = require('expo-server-sdk');
const expo = new Expo();
const express = require('express')
const bodyParser = require('body-parser')
const session = require('express-session');
const { check, validationResult } = require('express-validator/check');
const app = express()
app.use(session({secret: "secret"}));
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

// endpoint for registration
app.post('/register', [
    jsonParser,
    check('username').exists(),
    check('password').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        var usersRef = db.collection('users');
        usersRef.get().then(snapshot => {
            let found = false;
            snapshot.forEach(doc => {
                if (req.body.username == doc.data().username) {
                    found = true;
                }
            });
            
            if (found) {
                return res.status(409).json({
                    "reason" : "username already exists"
                });
            } else {
                usersRef.add({
                    "username" : req.body.username,
                    "password" : req.body.password,
                    "sessionID" : req.sessionID
                }).then(ref => {
                    return res.status(200).json({
                        "sessionID" : req.sessionID
                    });
                });
            }
    });
});

// endpoint for login
app.post('/login', [
    jsonParser,
    check('username').exists(),
    check('password').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        var usersRef = db.collection('users');
        usersRef.get().then(snapshot => {
            let valid = false;
            let refID = null;
            let sessionID = null;
            snapshot.forEach(doc => {
                if (req.body.username == doc.data().username && req.body.password == doc.data().password) {
                    valid = true;
                    refID = doc.id;
                    sessionID = doc.data().sessionID;
                }
            });
            
            if (!valid) {
                return res.status(401).json({
                    "reason" : "invalid username or password"
                });
            } else {
                console.log(refID);
                return res.status(200).json({
                    "sessionID" : sessionID
                });
            }
    });
});

// endpoint for creating group
app.post('/register', [
    jsonParser,
    check('username').exists(),
    check('password').exists()
    ], (req, res) => {
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        var usersRef = db.collection('users');
        usersRef.get().then(snapshot => {
            let found = false;
            snapshot.forEach(doc => {
                if (req.body.username == doc.data().username) {
                    found = true;
                }
            });
            
            if (found) {
                return res.status(409).json({
                    "reason" : "username already exists"
                });
            } else {
                usersRef.add({
                    "username" : req.body.username,
                    "password" : req.body.password
                }).then(ref => {
                    return res.status(200).json({
                        "sessionID" : req.sessionID
                    });
                });
            }
    });
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
            tokens.push(doc.data().token);
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
