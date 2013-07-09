'use strict';

/**
 * A simple object representation of a given page.
 *
 * @constructor
 * @api public
 */
function Page(pipe) {
  this.pipe = pipe;                         // Pipe wrapper.
  this.connections = Object.create(null);   // Stores active real-time connections.
  this.conditional = [];                    // Pagelets that are conditional.
  this.disabled = {};                       // Disabled pagelets.
  this.enabled = {};                        // Enabled pagelets.

  //
  // Don't allow any further extensions of the object. This improves performance
  // and forces people to stop maintaining state on the "page". As Object.seal
  // impacts the performance negatively, we're just gonna enable it for
  // development only so people will be caught early on.
  //
  if ('development' === this.env) Object.seal(this);
}

Page.prototype.__proto__ = require('events').EventEmitter.prototype;

/**
 * The HTTP pathname that we should be matching against.
 *
 * @type {String|RegExp}
 * @public
 */
Page.prototype.path = '/';

/**
 * Which HTTP methods should this page accept. It can be a string, comma
 * separated string or an array.
 *
 * @type {String|Array}
 * @public
 */
Page.prototype.method = 'GET';

/**
 * The default status code that we should send back to the user.
 *
 * @type {Number}
 * @public
 */
Page.prototype.statusCode = 200;

/**
 * The environment that we're running this page in. If this is set to
 * `development` It would be verbose.
 *
 * @type {String}
 * @public
 */
Page.prototype.env = (process.env.NODE_ENV || 'development').toLowerCase();

/**
 * The pagelets that need to be loaded on this page.
 *
 * @type {Object}
 * @public
 */
Page.prototype.pagelets = {};

/**
 * Parameter parsers, key is the name of param and value the function that
 * parsers it.
 *
 * @type {Object}
 * @public
 */
Page.prototype.parsers = {};

/**
 * List of resources that can be used by the pagelets.
 *
 * @type {object}
 * @public
 */
Page.prototype.resources = {};

/**
 * Expose our async flow control library.
 *
 * @type {Object}
 * @public
 */
Page.prototype.async = require('async');

/**
 * Discover pagelets that we're allowed to use.
 *
 * @api private
 */
Page.prototype.discover = function discover(req) {
  var page = this
    , pagelets;

  pagelets = this.pagelets.map(function allocate(Pagelet) {
    return Pagelet.alloc().configure(page);
  });

  //
  // The Pipe#transform has transformed our pagelets object in to an array so we
  // can easily iternate over them.
  //
  this.async.filter(pagelets, function rejection(pagelet, done) {
    //
    // Check if the given pagelet has a custom authorization method which we
    // need to call and figure out if the pagelet is available.
    //
    if ('function' === typeof pagelet.authorize) pagelet.authorize(req, done);
    done(true);
  }, function acceptance(allowed) {
    page.enabled = allowed;
    page.disabled = pagelets.filter(function disabled(pagelet) {
      return !!allowed.indexOf(pagelet);
    });
  });
};

/**
 * Reset the instance to it's orignal state and initialise it.
 *
 * @param {ServerRequest} req HTTP server request.
 * @param {ServerResponse} res HTTP server response.
 * @api private
 */
Page.prototype.configure = function configure(req, res) {
  var key;

  for (key in this.connections) {
    delete this.connections[key];
  }

  for (key in this.enabled) {
    delete this.enabled[key];
  }

  for (key in this.disabled) {
    delete this.enabled[key];
  }

  this.conditional.length = 0;
  this.removeAllListeners();

  this.discover();

  return this;
};

//
// Make's the Page extendable.
//
Page.extend = require('extendable');

//
// Expose the constructor.
//
module.exports = Page;
