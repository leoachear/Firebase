function runExample(demoUrl) {
    var fbRef = new Firebase(demoUrl);
    var groupsRef = fbRef.child('groups');
    var indexRef = fbRef.child('users/mchen/groups');
    
    /******************
     Monitor the index
     for add/remove events
     ******************/
    indexRef.on('child_added', added);
    indexRef.on('child_removed', removed);

    function added(idxSnap, prevId) {
        // when an item is added to the index, fetch the data
        groupsRef.child(idxSnap.key()).once('value', function (dataSnap) {
            addToList(dataSnap.key(), dataSnap.val(), prevId);
        });
    }

    function removed(snap) {
        dropFromList(snap.key());
    }
    
    /**********************
     Add and remove items from
     the index when group buttons
     are pressed
     **********************/

    // catch button clicks and trigger add/remove
    watchForButtonClicks(addToIndex, dropFromIndex);
    
    function addToIndex(id) {
        indexRef.child(id).set(true);
    }
    
    function dropFromIndex(id) {
        indexRef.child(id).remove();
    }
    
    /**************************
     Demo fluff to build the UI
     and make it semi-pretty
     **************************/
    var indexGroups = {};
    indexRef.on('value', update);

    function watchForButtonClicks(add, remove) {
        $('ul.index button').click(function() {
           var myId = $(this).closest('li').attr('data-id');
            if( !indexGroups.hasOwnProperty(myId) ) {
                add(myId);   
            }
            else {
                remove(myId);
            }
        });   
    }
    
    function addToList(key, data, prevId) {
       $prev = getPrevItem(prevId);
       var $item = $('<li></li>')
           .text(data.name)
           .attr('data-id',key);
        if( $prev ) {
           $item.insertAfter($prev);   
        }
        else {
           $item.prependTo('ul.groups');   
        }
        return $item;   
    }
    
    function dropFromList(key) {
       $('ul.groups').find('li[data-id="'+key+'"]').remove();
    }
    
    function getPrevItem(prevId) {
        if( prevId !== null ) {
           return $('ul.groups').find('li[data-id="'+prevId+'"]');   
        }
    }
    
    function update(snap) {
        indexGroups = snap.val()||{};
        log(snap);
        $('ul.index li').each(function() {
            var myId = $(this).attr('data-id');
            var hasGroup = indexGroups.hasOwnProperty(myId);
            $(this).find('button').text(hasGroup? 'delete' : 'add');
        });
    }

    function log(snap) {
        $('pre').text(JSON.stringify(snap.val(), null, 2));
    }
}

// Dependencies used in this fiddle:
// code.jquery.com/jquery-2.1.0.min.js
// cdn-gh.firebase.com/demo-utils-script/demo-utils.js
//
// This line creates a unique, private Firebase URL 
// you can hack in! Have fun!
$.loadDemo('web/org', 'org/index-example').then(runExample);