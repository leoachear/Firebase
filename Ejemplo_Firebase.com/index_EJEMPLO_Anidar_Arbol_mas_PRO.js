function runExample(demoUrl) {
    var fbRef = new Firebase(demoUrl);
    var groupsRef = fbRef.child('groups');
    var messagesRef = fbRef.child('messages');
    var indexRef = fbRef.child('/users/chuck/groups');
    var userCache = new UsersCache(fbRef.child('users'));
    var groups = {};

    /******************
       Monitor Mary's list of groups (an index)
       for add/remove events
     ******************/
    indexRef.on('child_added', addedGroup);
    indexRef.on('child_removed', removedGroup);

    /**********************
       When a group is added or removed, start listening
       on that group.
     **********************/
    function addedGroup(snapshot) {
       // Create a new Group object
       var group = new Group(snapshot, addMessageToDom);
       // Store the group for easy reference by it's key
       groups[group.key] = group;
       // Add it to the dom after initial data loads
       group.ready().then(addGroupToDom);
    }

    function removedGroup(snapshot) {
       // Removed deleted groups from the DOM
       removeGroupFromDom(snapshot.key());  
       // Tell the group it is no longer needed
       groups[snapshot.key()].remove();
    }
    
    /**********************
     Group Class
     *********************/
    function Group(snapshot, messageHandler) {
       this.key = snapshot.key();
       this.messageHandler = messageHandler;
       
       // a promise resolved when initial data is fetched
       this.deferred = $.Deferred();
        
       // populated by this._update()
       this.name = null;
       this.members = {};
       
       // monitor the group meta data for updates
       groupsRef.child(this.key).on('value', this._update, this);
        
       // Listen for incoming messages and invoke the _newMessage function
       // when one arrives
       messagesRef.child(this.key)
           .on('child_added', this._newMessage, this);
    }
    
    Group.prototype.remove = function() {
        // If a group is deleted from the user's profile, we don't need
        // to listen for changes anymore, so we turn off the child_added listener
       messagesRef.child(this.key)
           .off('child_added', this._newMessage, this);
       groupsRef.child(this.key)
           .off('value', this._update, this);
    }
    
    Group.prototype._newMessage = function(snapshot) {
        console.log('new message');
       // Fetch the data out of the Firebase snapshot
       var messageData = snapshot.val();
       // Localize some variables for use in the callback
       var handler = this.messageHandler;
       var groupKey = this.key;
       // Fetch the user's profile from our local user cache
       userCache.getUser(messageData.user).then(function(user) {
          console.log('loaded user');
          // add the user's name to the message data and
          // send it to the message handler
          messageData.name = user.name;
          handler( groupKey, messageData );
       });
    };
    
    Group.prototype._update = function(snapshot) {
       var data = snapshot.val()||{};
       this.name = data.name;
       this.members = data.members;
        
       // the first time this method is called, resolve
       // the ready promise
       this.deferred.resolve(this);
    };
    
    Group.prototype.ready = function() {
       return this.deferred.promise();
    };
    
    /**********************
      UsersCache
      
      Used to fetch data about specific users and cache it locally,
      since we assume the names appearing in chat will have a lot of
      duplication. Updates the user records whenever data changes.
    **********************/
    function UsersCache( refToUsersPath ) {
       this.ref = refToUsersPath;
       this.userPromises = {};
    }
    
    UsersCache.prototype.getUser = function(userId) {
       if( !this.userPromises.hasOwnProperty(userId) ) {
          this.userPromises[userId] = this._monitor(userId);
       }
       return this.userPromises[userId];
    };
    
    UsersCache.prototype._monitor = function(userId) {
       var def = $.Deferred();
       this.ref.child(userId).on('value', function(snapshot) {
          def.resolve(snapshot.val());
       });        
       return def.promise();
    };

    /**********************
      Capture UI events and modify the index
    ***********************/

    // catch button clicks and trigger add/remove
    watchForButtonClicks(addToIndex, dropFromIndex);

    function addToIndex(id) {
        // Create the index entry, there's nothing else to do here
        // because listeners just attach themselves to the data
        // so we don't need coupling or information about who cares
        // that we updated this index; they are already listening to
        // that path!
        indexRef.child(id).set(true);
    }

    function dropFromIndex(id) {
        // Remove the index entry. Like addToIndex, there's nobody
        // to notify, because they just attach themselves to the Firebase
        // path to get events
        indexRef.child(id).remove();
    }

	/**************************************************
          DEMO FLUFF

          Most of the stuff from here on is used to make
          the UI shiny and print the results to the DOM.
          It's probably not interesting for learning 
          Firebase
    ***************************************************/

    // updates the checkboxes for Chuck's Groups
    indexRef.on('child_added', addIndexEntry);
    indexRef.on('child_removed', removeIndexEntry);
    
    // this just prints the groups data to the screen
    indexRef.on('value', function(snap) {
       log( 'jsonGroups', snap.val() ); 
    });
    
    // print out the users who are being cached
    setInterval(function() {
       log( 'jsonUsers', Object.keys(userCache.userPromises) );
    }, 250);
    
    function addGroupToDom(group) {
        console.log('add group', group.key, group.name);
        $('<li></li>')
            .attr('data-id', group.key)
            .append( $('<b></b>').text(group.name) )
            .append('<ul></ul>')
        	.appendTo('#messages');
        $('#index li[data-id="' + group.key + '"]').addClass('yes');
    }
    
    function removeGroupFromDom(groupKey) {
       $('#messages li[data-id="' + groupKey + '"]').remove();
       $('#index li[data-id="' + groupKey + '"]').removeClass('yes');
    }
    
    function addMessageToDom(groupKey, message) {
        console.log('add message to dom', groupKey, message);
        $('<li></li>')
            .text(message.message)
            .addClass('message')
            .prepend( $('<span>').text(message.name) )
            .appendTo('#messages li[data-id="' + groupKey + '"] ul');           
    }

    function watchForButtonClicks(add, remove) {
        $('#index input[type="checkbox"]')
            .click(function () {
            	console.log('clicked');
                var myId = $(this).attr('name');
                if( $(this).prop('checked') ) {
                    add(myId);
                } else {
                    remove(myId);
                }
            });
    }

    // updates the /users/chuck/groups data
    // and the checkboxes for Chuck's groups
    function addIndexEntry(snap) {
        $('ul#index input[name="' + snap.key() + '"]')
        	.prop('checked', true);
    }
    
    function removeIndexEntry(snap) {
        $('ul#index input[name="' + snap.key() + '"]')
        	.prop('checked', false);
    }
    
    function unwrapPromises(data) {
       var results = {};
       Object.keys(data).forEach(function(key) {
          data[key].then(function(val) {
              results[key] = val;
          });
       });
       return $.when(data).then(function() {
           return results;
       });
    }

    function log(id, data) {
        $('#'+id).text(JSON.stringify(data, null, 2));
    }
}

// Dependencies used in this fiddle:
// code.jquery.com/jquery-2.1.0.min.js
// cdn-gh.firebase.com/demo-utils-script/demo-utils.js
//
// This line creates a unique, private Firebase URL 
// you can hack in! Have fun!
$.loadDemo('web/struct/join-example', 'web/struct/join-example').then(runExample);