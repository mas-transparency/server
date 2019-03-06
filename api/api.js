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

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
