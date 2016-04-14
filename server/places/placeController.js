var Sequelize = require('sequelize');
var Place = require(__dirname + '/placeModel.js');
var User = require(__dirname + '/../users/userModel.js');
var GOOGLE_PLACES_API_KEY = require(__dirname + '/../config/googleplaces.js');
var request = require('request');
var urlParser = require('url');


module.exports.getAllSaved = function(req, res) {
  var user = req.body.user; // so far this is undefined

  console.log('In placeController getAllSaved this is the req.body.user:', user);
  // TODO: We need to get the user id or google user id field passed
  // through from the client. Instead of using lastName to lookup a user, 
  // ideally we'd use the below line of code:
  // User.findOne({where: {googleUserId: user.googleUserId} }) 
  User.findOne({
    where: {lastName: user.lastName}
  })
  .then(function(foundUser) {
    foundUser.getPlaces();
  })
  .then(function(foundPlaces) {
    console.log('In placeController.js in getAllSaved, the foundPlaces returned are: ', foundPlaces);
    res.json(foundPlaces);
  });
};

module.exports.saveOne = function(req, res) {
  var user = req.body.user;
  var place = req.body.place;

  User.findOne({
    where: {title: 'aProject'}
  })
  .then(function(foundUser) {
    foundUser.addPlace(place);
  })
  .then(function(createdPlace) {
    // TODO: We need to verify that the createdPlace is returned from the addPlace method
    // it's not shown in the docs what the return value is
    console.log('In placeController.js in saveOne, the place returned is: ', createdPlace);
    res.json(createdPlace);
  });
};

module.exports.deleteOnePlace = function(req, res) {
  var user = req.body.user;

  // the client will pass in a place obj w/ googlePlaceId, name, address
  var place = req.body.place;

  // find the id of the place given the googlePlaceId
  Place.findOne({ 
    where: {googlePlaceId: place.googlePlaceId} 
  })
  .then(function(place) {
    // remove the association between the user and the place
    user.removePlace(place);
      // TODO: For future, do a check: 
      // if no users have a place with the same id as this one,
      // delete that place from the places table so that you don't end
      // up with lots of places that aren't associated with any users.
      // This will only matter if this app goes global!
  });
};


//Make a get call to Google Places radarsearch endpoint, get back 200 results;
//Make a get call to Google Places details endpoint for each of the 200 results, match their reviews against regexes, send filtered and simplified results back to client;
//Use a counter to make sure the results are only sent to client after all the initial results have been examined.
module.exports.searchGoogle = function(req, res) {

  var searchString = urlParser.parse(req.url).search; //include leading question mark
  var regex1 = new RegExp(/(good|great|awesome|fantastic|terrific|nice|cool|wonderful|dope|beautiful|amazing|gorgeous|breathtaking|scenic|panoramic|stunning) view/);
  var regex2 = new RegExp(/view (is|was) (good|great|awesome|fantastic|terrific|nice|cool|wonderful|dope|beautiful|amazing|gorgeous|breathtaking|scenic|panoramic|stunning)/);

  request.get('https://maps.googleapis.com/maps/api/place/radarsearch/json' + searchString + '&key=' + GOOGLE_PLACES_API_KEY)
    .on('response', function(response) { //layer 1 on 'response'

      var body = [];

      response.on('data', function(chunk) { //layer 2 on 'data'
        body.push(chunk);
      }).on('end', function() { //layer 2 on 'end'
        body = JSON.parse(Buffer.concat(body).toString());
        var filteredBody = {};
        filteredBody.places = [];
        if (body.results && body.results.length > 0) {

          var places = body.results;
          var counter = 0; //ensure server only sends back filteredBody if all places have been processed
          for (var i = 0; i < places.length; i++) {
            var place = places[i];
            var placeid = place['place_id'];

            request.get('https://maps.googleapis.com/maps/api/place/details/json?' + 'key=' + GOOGLE_PLACES_API_KEY + '&placeid=' + placeid)
              .on('response', function(response) { //layer 3 on 'response'
                var body = [];
                response.on('data', function(chunk) { //layer 4 on 'data'
                  body.push(chunk);
                }).on('end', function() { //layer 4 on 'end'
                  body = JSON.parse(Buffer.concat(body).toString());
                  var placeDetails = body.result;
                  var reviews = placeDetails.reviews;
                  if (reviews) {
                    for (var j = 0; j < reviews.length; j++) {
                      var review = reviews[j];
                      if (review.text.match(regex1) || review.text.match(regex2)) { //TODO: improve regex matching
                        filteredBody.places.push({
                          name: placeDetails.name,
                          address: placeDetails['formatted_address'],
                          placeid: placeid
                        });
                        break;
                      }
                    }
                  }
                  counter++;
                  if (counter === places.length) {
                    res.json(filteredBody);
                  }
                }); //end of layer 4 on 'end'
              }) //end of layer 3 on 'response'
              .on('error', function(error) { //layer 3 on 'error'
                //TODO: handle error
                counter++;
                if (counter === places.length) {
                  res.json(filteredBody);
                } 
              }) //end of layer 3 on 'error'
          }
          
        } else {
          res.json(filteredBody);
        }
      }); //end of layer 2 on 'end'
    }) //end of layer 1 on 'response'
    .on('error', function(error) { //layeon 'error'
      //TODO: handle error
    }); //end of layer 1 on 'error'
};

