YUI.add('history-base', function(Y) {

/**
 * Provides browser history management functionality using a simple
 * add/replace/get paradigm.
 *
 * <p>
 * The history-base module uses a simple object to store state. To integrate
 * state management with browser history and allow the back/forward buttons to
 * navigate between states, use history-hash.
 * </p>
 *
 * @module history
 * @submodule history-base
 */

/**
 * The HistoryBase class provides basic state management functionality backed by
 * an object. History state is shared globally among all instances and
 * subclass instances of HistoryBase.
 *
 * <p>
 * If provided, the optional <em>initialState</em> object will be merged with
 * the current global state.
 * </p>
 *
 * @class HistoryBase
 * @uses EventTarget
 * @constructor
 * @param {Object} config (optional) configuration object, which may contain
 *   zero or more of the following properties:
 *
 * <dl>
 *   <dt>initialState (Object)</dt>
 *   <dd>
 *     Initial state to set, as an object hash of key/value pairs.
 *   </dd>
 * </dl>
 */

var Lang       = Y.Lang,
    Obj        = Y.Object,
    GlobalEnv  = YUI.namespace('Env.History'),

    EVT_CHANGE = 'change',
    NAME       = 'historyBase',

HistoryBase = function (config) {
    this._init.apply(this, arguments);
};

Y.augment(HistoryBase, Y.Event.Target, null, null, {
    emitFacade : true,
    prefix     : 'history',
    preventable: false,
    queueable  : true
});

if (!GlobalEnv._state) {
    GlobalEnv._state = {};
}

// -- Public Static Properties -------------------------------------------------

/**
 * Name of this component.
 *
 * @property NAME
 * @type String
 * @static
 */
HistoryBase.NAME = NAME;

Y.mix(HistoryBase.prototype, {
    // -- Initialization -------------------------------------------------------

    /**
     * Initializes this HistoryBase instance. This method is called by the
     * constructor.
     *
     * @method _init
     * @param {Object} config configuration object
     * @protected
     */
    _init: function (config) {
        var initialState = config && config.initialState;

        /**
         * Fired when the state changes. To be notified of all state changes
         * regardless of the History or YUI instance that generated them,
         * subscribe to this event on Y.Global. If you would rather be notified
         * only about changes generated by this specific History instance,
         * subscribe to this event on the instance.
         *
         * @event history:change
         * @param {EventFacade} Event facade with the following additional
         *   properties:
         *
         * <dl>
         *   <dt>changed</dt>
         *   <dd>
         *     Object hash of state items that have been added or changed. The
         *     key is the item key, and the value is an object containing
         *     <code>newVal</code> and <code>prevVal</code> properties
         *     representing the values of the item both before and after the
         *     change. If the item was newly added, <code>prevVal</code> will be
         *     <code>undefined</code>.
         *   </dd>
         *
         *   <dt>newVal</dt>
         *   <dd>
         *     Object hash of key/value pairs of all state items after the
         *     change.
         *   </dd>
         *
         *   <dt>prevVal</dt>
         *   <dd>
         *     Object hash of key/value pairs of all state items before the
         *     change.
         *   </dd>
         *
         *   <dt>removed</dt>
         *   <dd>
         *     Object hash of key/value pairs of state items that have been
         *     removed. Values are the old values prior to removal.
         *   </dd>
         * </dl>
         */
        this.publish(EVT_CHANGE, {
            broadcast: 2,
            defaultFn: Y.bind(this._defChangeFn, this)
        });

        // If initialState was provided and is a simple object, merge it into
        // the current state.
        if (Lang.isObject(initialState) && !Lang.isFunction(initialState) &&
                !Lang.isArray(initialState)) {
            this.add(Y.merge(GlobalEnv._state, initialState));
        }
    },

    // -- Public Methods -------------------------------------------------------

    /**
     * Adds a state entry with new values for the specified key or keys. Any key
     * with a <code>null</code> or <code>undefined</code> value will be removed
     * from the state; all others will be merged into it.
     *
     * @method add
     * @param {Object|String} state object hash of key/value string pairs, or
     *   the name of a single key
     * @param {String|null} value (optional) if <em>state</em> is the name of a
     *   single key, <em>value</em> will become its new value
     * @chainable
     */
    add: function (state, value) {
        var key;

        if (Lang.isString(state)) {
            key        = state;
            state      = {};
            state[key] = value;
        }

        this._resolveChanges(Y.merge(GlobalEnv._state, state));
        return this;
    },

    /**
     * Returns the current value of the state parameter specified by
     * <em>key</em>, or an object hash of key/value pairs for all current state
     * parameters if no key is specified.
     *
     * @method get
     * @param {String} key (optional) state parameter key
     * @return {Object|mixed} value of the specified state parameter, or an
     *   object hash of key/value pairs for all current state parameters
     */
    get: function (key) {
        var state = GlobalEnv._state;

        if (key) {
            return Obj.owns(state, key) ? state[key] : undefined;
        } else {
            return Y.mix({}, state, true);
        }
    },

    /**
     * Replaces the current state entry with new values for the specified
     * parameters, just as with <code>add()</code>, except that no change events
     * are generated.
     *
     * @method replace
     * @param {Object|String} state object hash of key/value string pairs, or
     *   the name of a single key
     * @param {String|null} value (optional) if <em>state</em> is the name of a
     *   single key, <em>value</em> will become its new value
     * @chainable
     */
    replace: function (state, value) {
        var key;

        if (Lang.isString(state)) {
            key        = state;
            state      = {};
            state[key] = value;
        }

        this._resolveChanges(Y.merge(GlobalEnv._state, state), true);
        return this;
    },

    // -- Protected Methods ----------------------------------------------------

    /**
     * Fires a dynamic "[key]Change" event.
     *
     * @method _fireChangeEvent
     * @param {Object} value object hash containing <em>newVal</em> and
     *   <em>prevVal</em> properties for the changed item
     * @param {String} key key of the item that was changed
     * @protected
     */
    _fireChangeEvent: function (value, key) {
        // TODO: how to document this?
        this.fire(key + 'Change', {
            newVal : value.newVal,
            prevVal: value.prevVal
        });
    },

    /**
     * Fires a dynamic "[key]Remove" event.
     *
     * @method _fireRemoveEvent
     * @param {mixed} value value of the item prior to its removal
     * @param {String} key key of the item that was removed
     * @protected
     */
    _fireRemoveEvent: function (value, key) {
        // TODO: how to document this?
        this.fire(key + 'Remove', {prevVal: value});
    },

    /**
     * Called by _resolveChanges() when the state has changed. This method takes
     * care of actually firing the history:change event if <em>silent</em> is
     * <code>false</code>, or storing the new state if <em>silent</em> is
     * <code>true</code>.
     *
     * @method _handleChanges
     * @param {Object} changes resolved changes
     * @param {Boolean} silent (optional) if <em>true</em>, no change events
     *   will be fired
     * @protected
     */
    _handleChanges: function (changes, silent) {
        if (silent) {
            this._storeState(changes.newState, true);
        } else {
            // Fire the global change event.
            this.fire(EVT_CHANGE, {
                changed: changes.changed,
                newVal : changes.newState,
                prevVal: changes.prevState,
                removed: changes.removed
            });

            // Fire change/remove events for individual items.
            Obj.each(changes.changed, this._fireChangeEvent, this);
            Obj.each(changes.removed, this._fireRemoveEvent, this);
        }
    },

    /**
     * Resolves the changes (if any) between <em>newState</em> and the current
     * state and fires appropriate events if things have changed.
     *
     * @method _resolveChanges
     * @param {Object} newState object hash of key/value pairs representing the
     *   new state
     * @param {Boolean} silent (optional) if <code>true</code>, no change events
     *   will be fired
     * @protected
     */
    _resolveChanges: function (newState, silent) {
        var changed   = {},
            isChanged,
            prevState = GlobalEnv._state,
            removed   = {};

        newState = newState || {};

        // Figure out what was added or changed.
        Obj.each(newState, function (newVal, key) {
            var prevVal = prevState[key];

            if (newVal !== prevVal) {
                changed[key] = {
                    newVal : newVal,
                    prevVal: prevVal
                };

                isChanged = true;
            }
        }, this);

        // Figure out what was removed.
        // TODO: Could possibly improve performance slightly by not checking
        // keys that have been added/changed, since they obviously haven't been
        // removed. Need to profile to see if it's actually worth it.
        Obj.each(prevState, function (prevVal, key) {
            if (!Obj.owns(newState, key) || newState[key] === null) {
                delete newState[key];
                removed[key] = prevVal;
                isChanged = true;
            }
        }, this);

        if (isChanged) {
            this._handleChanges({
                changed  : changed,
                newState : newState,
                prevState: prevState,
                removed  : removed
            }, silent);
        }
    },

    /**
     * Stores the specified state. Don't call this method directly; go through
     * _resolveChanges() to ensure that changes are resolved and all events are
     * fired properly.
     *
     * @method _storeState
     * @param {Object} newState new state to store
     * @param {Boolean} silent (optional) if <em>true</em>, the state change
     *   should be silent
     * @protected
     */
    _storeState: function (newState, silent) {
        GlobalEnv._state = newState || {};
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
     * Default change event handler.
     *
     * @method _defChangeFn
     * @param {EventFacade} e state change event facade
     * @protected
     */
    _defChangeFn: function (e) {
        this._storeState(e.newVal);
    }
}, true);

Y.HistoryBase = HistoryBase;


}, '@VERSION@' ,{requires:['event-custom-complex']});
