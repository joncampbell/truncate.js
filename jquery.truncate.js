/*
 * jQuery truncate plugin, version 3.0 [2012-02-04]
 * Copyright 2012, Perfect Sense Digital LLC
 * Author: Brendan Brelsford [brendanb@gmail.com]
 * Licensed under the MIT license [http://opensource.org/licenses/MIT]
 *
 * Usage:
 *
 *     Invocation
 *
 *     $('.selector').truncate(options);
 *
 *     Event Binding (after invocation)
 *
 *     $('.selector').truncate('bind', 'show', function(){ // do something when full text is shown});
 *
 * Events:
 *
 *     Events are triggered on the following state changes of the selected element.  No events are triggered
 *     on the initial invocation of the truncate plugin.
 *
 *     "show" - Triggered when full text is shown.  If options.animate is specified to be true, then this event will fire
 *                  after the animation has completed.
 *
 *     "hide" - Triggered when full text is truncated.  If options.animate is specified to be true, then this event will fire
 *                  after the animation has completed.
 *
 *     "toggle" - Triggered both when full text is shown and truncated.  If options.animate is specified to be true, then this
 *                  event will fire after the animation has completed.
 *
 * Options:
 *
 *     Options are passed as a flat javascript object with the following allowed keys:
 *
 *     "maxLines" - The maximum number of lines to display when the element is truncated.
 *                  Allowed Values: integer > 0
 *                  Default Value: 1
 *
 *     "lineHeight" - The line-height value that should be used to calculate the vertical truncation point.  If unspecified,
 *                  it will be calculated using the CSS value from each selected element.
 *                  Allowed Values: integer > 0
 *                  Default Value: null
 *
 *     "truncateString" - Suffix to append to truncated text. e.g. &nbsp;&#8230; (non-breaking space followed by an ellipsis).
 *                  Allowed Values: any string
 *                  Default Value: ''
 *
 *     "truncateAfterLinks" - Indicates whether options.truncateString should be appended after anchor tags when the truncation
 *                  point occurs inside an anchor tag.  Since the truncateString is not part of the original anchor text, it is
 *                  desirable to exclude it from the anchor tag.  In cases where anchor tags display as block, however, this can
 *                  cause the truncateString to display on a line below the anchor tag.
 *                  Allowed Values: true / false
 *                  Default Value: true
 *
 *     "showText" - If specified, will be shown as a hyperlink appended to the truncated text.  When clicked, this link
 *                  will toggle the truncated element to its full-text state. e.g. ("more")
 *                  Allowed Values: any string
 *                  Default Value: ''
 *
 *     "hideText" - If specified, will be shown as a hyperlink appended to the full text.  When clicked, this link will
 *                  toggle the full-text element to its truncated state.  e.g. ("less")
 *                  Allowed Values: any string
 *                  Default Value: ''
 *
 *     "collapsed" - Indicates whether the truncated element should be initially displayed in a full-text or truncated state.
 *                  Allowed Values: true / false
 *                  Default Value: true
 *
 *     "debug" - Indicates whether messages should be written to console.log including the truncation execution time and
 *                  number of binomal search steps used to truncate the full text.  The usage of console.log in this plugin
 *                  is always safe for inclusion in IE.
 *                  Allowed Values: true / false
 *                  Default Value: false
 *
 *     "contextParent" - A parent DOM element to use as the cloned element for measuring height of the cloned text.  This is necessary
 *                  when the text node can have its text displaced by floated elements inside a common parent.
 *                  Allowed Values: jQuery object
 *                  Default Value: null
 *
 *     "tooltip" - Indicates whether the original TEXT content should be set in a title attribute on the truncated element.  This will
 *                  strip all HTML for compatibility with HTML attribute syntax.
 *                  Allowed Values: true / false
 *                  Default Value: false
 *
 *     "animate" - Indicates whether the user-initiated transitions between truncated and full text should animate the height.  
 *                  Allowed Values: true / false
 *                  Default Value: false
 *
 *     "animateOptions" - If specified, will be passed into jQuery's $.fn.animate options parameter.
 *                  Allowed Values: object
 *                  Default Value: empty object
 *
 * Methods:
 *
 *      Methods are invoked via $('.selector').truncate(methodName, arguments...)
 *
 *      "options" - Pass an object argument to reset the options.  This does not immediately trigger an updated truncation.
 *
 *      "update" - Takes an optional second argument to pass new HTML.  With or without the argument, the original truncated
 *                 element will be re-truncated.  This is useful to hook into a callback when the truncated element can be
 *                 subject to re-sizing (i.e. responsive design).  If no HTML is passed, but the contents of the truncated text
 *                 have been modified, the modified text will be used in place of the original.
 *
 * Examples:
 *
 *     Truncate to 3 lines with a trailing ellipsis, "Read More" text when collapsed, and no hide text.
 *
 *     $('.selector').truncate({
 *         'maxLines': 3,
 *         'truncateString': '&nbsp;&#8230;',
 *         'showText': 'Read More'
 *     });
 *
 *     Truncate to 3 lines with a trailing ellipsis, relative to a context parent that includes a floated image.
 *
 *     var $el = $('.selector');
 *     var $contextParent = $el.closest('.parent-selector');
 *
 *     $('.selector').truncate({
 *         'maxLines': 3,
 *         'truncateString': '&nbsp;&#8230;',
 *         'contextParent': $contextParent
 *     });
 *
 * Known Issues:
 *     - The "update" method with 0 parameters will fail to recognize a change in the truncated HTML if the HTML length is
 *         the same as before the change was made.
 */


if (typeof jQuery !== 'undefined') {
    (function($) {
        var cumulativeExecutionTime = 0;

        // matching expression to determine the last word in a string.
        var lastWordPattern = /(?:^|\W*)\w*$/;
        // first word MUST be suffixed by non-alpha, since usage of this regexp occurs in a spliced segment of the original string
        var firstWordPattern = /(?:\w+)(?=\W+|$)/;

        // define "setNodeText" differently for Internet Explorer
        var setNodeText = /msie/i.exec(navigator.userAgent) !== null ? function(node, text) {
            node.nodeValue = text;
        } : function(node, text) {
            node.textContent = text;
        };

        // defines a utility function to splice HTML at a text offset
        var getHtmlUntilTextOffset = function(html, offset, truncateString, truncateAfterLinks) {

            var queue = [];
            var $html = $('<div/>');
            $html.html(html);
            var textLen = 0;

            // testing var to prevent infinite loops
            var count = 0;

            // remove child nodes from this node and push all onto the queue in reverse order (this implements depth-first search).
            var rootChildren = $html.contents().detach();
            var n = 0;
            for(n = rootChildren.size() - 1; n >= 0; --n) {

                queue.push({$parent: $html, node: rootChildren.get(n)});
            }

            while((queue.length > 0) && (textLen < offset) && (count < 100)) {

                var queueItem = queue.pop();
                var node = queueItem.node;
                var $node = $(node);
                var nodeTextLen = 0;
                var nodeText;

                // process text nodes distinctly from other node types
                if(node.nodeType === 3) {

                    var $nodeParent = queueItem.$parent;

                    // append $node to $html with children.  if children were detached above, then this is an empty node
                    $nodeParent.append($node);

                    nodeText = $node.text();
                    nodeTextLen = nodeText.length;

                    // if the text node's contents would put textLen above offset, perform truncation
                    if (nodeTextLen > offset - textLen) {

                        var match = lastWordPattern.exec(nodeText.substring(0, offset - textLen));
                        var lastWordOffset = match.index + match[0].length;
                        setNodeText(node, nodeText.substring(0, lastWordOffset));

                        if(typeof truncateString !== 'undefined') {
                            if(!($nodeParent.is('a')) || truncateAfterLinks === false) {
                                $nodeParent.append(truncateString);
                            } else {
                                $nodeParent.parent().append(truncateString);
                            }
                        }

                        // stop processing nodes.  the last word that will not exceed the offset has been found.
                        textLen += lastWordOffset;
                        break;

                    } else {
                        textLen += nodeTextLen;
                    }

                } else {

                    nodeText = $node.text();
                    nodeTextLen = nodeText.length;

                    // if the text content of this node and its children is greater than the gap between the accumulated text length and offset
                    if(nodeTextLen > offset - textLen) {

                        // remove child nodes from this node and push all onto the queue in reverse order (this implements depth-first search).
                        var children = $node.contents().detach();
                        var i = 0;
                        for(i = children.size() - 1; i >= 0; --i) {

                            queue.push({$parent: $node, node: children.get(i)});
                        }
                    } else {

                        textLen += nodeTextLen;
                    }

                    // append $node to $html with children.  if children were detached above, then this is an empty node
                    queueItem.$parent.append($node);
                }

                if(textLen === offset) {
                    queueItem.$parent.append(truncateString);
                }
            }

            return $html.html();
        };

        var closestBlockLevelAncestor = function($el) {
            var $parent = $el.parent();
            while(typeof $parent !== 'undefined' && $parent.size() > 0) {
                if('inline' !== $parent.css('display')) {
                    return $parent;
                }
                $parent = $parent.parent();
            }
            return null;
        };

        // define main workhorse method, "truncate" to be used both on the initial call and on subsequent invocations of the "update" method
        var truncate = function($el, options, html) {

            // declare variable to store response value - the char offset at which truncation occurred
            var truncationPoint = null;

            // define DEBUG function specific to each instance
            var DEBUG = function() {

                var isDebug = window.location.hash.indexOf("_debugTruncate") !== -1;
                if((isDebug || options.debug === true) && typeof console !== 'undefined') {
                    if(/msie/i.exec(navigator.userAgent) !== null) {
                        var output = "";
                        var i;
                        for(i = 0; i < arguments.length; i+= 1) {
                            if(output.length > 0) {
                                output += ", ";
                            }
                            if(typeof arguments[i] === 'function') {
                                output += "[function]";
                            } else if(typeof arguments[i] === 'object' && typeof JSON === 'object' && typeof JSON.stringify === 'function') {
                                output += JSON.stringify(arguments[i]);
                            } else {
                                output += arguments[i].toString();
                            }
                        }
                        console.log(output);
                    } else {
                        try {
                            console.log.apply(null, arguments);
                        } catch(e) {
                            console.log(arguments);
                        }
                    }
                }
            };

            // options-based variables
            var showLinkHtml = options.showText !== '' ? ' <a class="show" href="#">' + options.showText + '</a>' : '';
            var hideLinkHtml = options.hideText !== '' ? ' <a class="hide" href="#">' + options.hideText + '</a>' : '';
            var maxHeight = options.maxLines * options.lineHeight;
            var realMaxHeight = maxHeight + options.lineHeight - 1;

            // used to debug the execution time
            var startTime = new Date();

            // this variable is used to hold the un-truncated HTML, since $el may already contain truncated HTML
            var $html = $('<div/>');
            $html.html(html);

            // proceed if the element has already been truncated, or if its height is larger than the real max height
            if (typeof $el.data('truncatePlugin') !== 'undefined' || $el.height() > realMaxHeight) {

                // check whether a $parent element was specified for a larger DOM context
                var $contextParent = (options.contextParent === null || options.contextParent === $el) ? $el : $(options.contextParent);

                // clone of the selected element
                var $doppleText;
                // clone of the options.contextParent, for use when contextParent is specified
                var $doppleParent;

                // If the contextParent contains the selected element, then they are ancestor-descendent.
                // If not, then set the contextParent to the element itself.
                if($contextParent.find($el).size() > 0) {

                    // If a contextParent was specified, then the cloned element itself must be found
                    // by navigating the original HTML structure and mirroring the navigation in the
                    // cloned HTML structure.
                    var childOffsets = [];
                    var $node = $el;
                    var $closestParent = $node.parent();
                    while($closestParent.size() !== 0 && !($closestParent.find($contextParent).size() > 0)) {

                        childOffsets.unshift($node.index());
                        $node = $closestParent;
                        $closestParent = $closestParent.parent();
                    }

                    // The array of childOffsets stores the offset of the cloned element's ancestor at each
                    // level of the DOM heirarchy, relative to the cloned parent.  By iteratively navigating
                    // to the specified child index, the cloned element can be found.
                    $doppleParent = $contextParent.clone();
                    $doppleText = $doppleParent;
                    var i;
                    for(i = 0; i < childOffsets.length; i++) {
                        var offset = childOffsets[i];
                        $doppleText = $doppleText.children().eq(offset);
                    }

                    // Always reset the html of the clone, because this function is used both for initial and repeat
                    // truncations.  In the latter case, $el.html() is already truncated, so the clone must use the original
                    // html, passed as a parameter to this method.
                    $doppleText.html(html);
                } else {

                    $doppleText = $el.clone();
                    // Always reset the html of the clone (see directly above)
                    $doppleText.html(html);
                    $doppleParent = $doppleText;
                }

                var width;
                if($contextParent.css('-moz-box-sizing') === 'border-box'
                    || $contextParent.css('-webkit-box-sizing') === 'border-box'
                    || $contextParent.css('box-sizing') === 'border-box') {
                    width = $contextParent.outerWidth();
                } else {
                    width = $contextParent.width();
                }

                // Position the clone outside the page but still visibile, so that the browser can accurately detect
                // its height during the binary search.
                $doppleParent.css({
                    'position': 'absolute',
                    'left': '0',
                    'top': '0',
                    'visibility': 'hidden',
                    'max-width': width // set max-width instead of width, because setting width directly can result in small display deviations
                });
                // Enforce the 'line-height' style to ensure that the calculation is correct.
                $doppleText.css({
                    'line-height': options.lineHeight + 'px',
                    'height': 'auto'
                });

                $contextParent.after($doppleParent);

                // Determine the un-truncated HTML height by measuring the cloned element.  This will work both for initial and
                // repeat calls to "truncate".
                var originalHeight = $doppleText.height();

                // This second check is for elements that have already been truncated before, because the true "originalHeight"
                // can only be determined in these cases after the $doppleText has been appended to the DOM
                if(originalHeight > realMaxHeight) {

                    var textString = $html.text();
                    var near = 0;
                    var far = textString.length;
                    var mid = far;
                    var truncatedHtml;

                    var count = 0;

                    // Iterate either until the binary search has ended or options.maxSteps has been reached
                    // Three markers are used to implement the binary search: near, mid, and far.
                    do {
                        if($doppleText.height() > realMaxHeight) {
                            // If the text is too long, bring in the "far" marker
                            far = mid;
                        } else {
                            // If the text is too short, push out the "near" marker
                            near = mid;
                        }

                        // re-calculate the new mid to be the closest word boundary before the numerical midpoint of near & far
                        var avg = Math.floor((far + near) / 2);
                        mid = lastWordPattern.exec(textString.substring(0, avg)).index;

                        // if this puts mid equal to near, try the first word pattern after the numerical midpoint of near & far
                        if(mid === near) {
                            var nextWord = firstWordPattern.exec(textString.substring(avg, far));
                            if(nextWord !== null) {
                                var nextWordAt = avg + nextWord.index + nextWord[0].length;
                                if(nextWordAt !== far) {
                                    mid = nextWordAt;
                                }
                            }
                        }

                        // Re-truncate the original HTML up to "mid" and put it into the cloned element
                        truncatedHtml = getHtmlUntilTextOffset(html, mid, options.truncateString, options.truncateAfterLinks);
                        $doppleText.html(truncatedHtml + showLinkHtml);
                        count++;
                    } while((count < options.maxSteps) && (mid > near) && (mid < far));

                    // truncatedHtml is already stored, so remove the cloned element
                    $doppleParent.remove();

                    // Append the either html + hideLinkHtml or truncatedHTML + showLinkHtml based on options.collapsed
                    if(options.collapsed === false) {
                        $el.html(html + hideLinkHtml);
                    } else {
                        $el.html(truncatedHtml + showLinkHtml);
                    }

                    // Enforce block display and the specified line-height on the truncated element
                    $el.css({
                        'display': 'block',
                        'line-height': options.lineHeight + 'px'
                    });

                    $el.undelegate('truncate');
                    // Delegate handlers to ".show" and ".hide" that swap the original / truncated HTML on click
                    $el.delegate('.show', 'click.truncate', function(event) {

                        event.preventDefault();

                        // fix the height before swapping in full content

                        $el.css({'height': maxHeight + 'px'});
                        $el.html(html + hideLinkHtml);
                        var $animateDfd = new $.Deferred();
                        $animateDfd.then(function() {

                            $el.css({'height': 'auto'});
                            $el.trigger('show');
                            $el.trigger('toggle');
                            if(options.tooltip === true) {
                                $el.removeAttr('title');
                            }
                        });

                        if(options.animate === true) {
                            var oldAnimateComplete = options['animateOptions']['complete'];
                            var animateOptions = $.extend(true, { }, options.animateOptions, {
                                'complete': function() {
                                    $animateDfd.resolve();
                                    oldAnimateComplete.apply(this, Array.prototype.slice.call(arguments, 1));
                                }
                            });
                            $el.animate({
                                'height': originalHeight + 'px'
                            }, animateOptions);
                        } else {
                            $animateDfd.resolve();
                        }
                    });

                    $el.delegate('.hide', 'click.truncate', function(event) {

                        event.preventDefault();

                        var $animateDfd = new $.Deferred();
                        $animateDfd.then(function() {
                            $el.html(truncatedHtml + showLinkHtml);
                            $el.trigger('hide');
                            $el.trigger('toggle');
                            if(options.tooltip === true) {
                                $el.attr('title', textString);
                            }
                        });

                        if(options.animate === true) {
                            var oldAnimateComplete = options['animateOptions']['complete'];
                            var animateOptions = $.extend(true, { }, options.animateOptions, {
                                'complete': function() {
                                    $animateDfd.resolve();
                                    oldAnimateComplete.apply(this, Array.prototype.slice.call(arguments, 1));
                                }
                            });
                            $el.animate({
                                'height': maxHeight + 'px'
                            }, animateOptions);
                        } else {
                            $animateDfd.resolve();
                        }
                    });

                    if(options.tooltip === true) {
                        $el.attr('title', textString);
                    }
                    DEBUG("truncate.js: truncated element with height " + originalHeight + "px > " + realMaxHeight + "px in " + count + " steps.");
                    truncationPoint = mid;

                } else {
                    $doppleParent.remove();
                    $el.html(html);
                    if(options.tooltip === true) {
                        $el.removeAttr('title');
                    }
                    truncationPoint = html.length;
                }
            } else {
                DEBUG("truncate.js: skipped processing element with height " + originalHeight + "px < " + realMaxHeight + "px");
                truncationPoint = html.length;
            }

            var endTime = new Date();

            cumulativeExecutionTime += (endTime - startTime);
            DEBUG("truncate.js: took " + (endTime - startTime) + "  ms to execute.");
            DEBUG("truncate.js: ", $el);
            DEBUG("truncate.js: cumulative execution time " + cumulativeExecutionTime + " ms");
            return truncationPoint;
        };

        function Truncate(el, options) {

            // --- Defaults ---
            this.defaults = {
                'maxLines': 1,
                'lineHeight': null,
                'truncateString': '',
                'truncateAfterLinks': true,
                'showText': '',
                'hideText': '',
                'collapsed': true,
                'debug': false,
                'contextParent': null,
                'maxSteps': 100,
                'tooltip': false,
                'animate': false,
                'animateOptions': {
                    'complete': function() { }
                }
            };

            // extend the default config with specified options
            this.config = $.extend(true, { }, this.defaults, options);

            // store a reference to the jQuery object
            this.$el = $(el);

            if(this.config['lineHeight'] === null) {
                var empiricalLineHeight = NaN;
                if("normal" === this.$el.css('line-height')) {

                    // Translate "normal" to a numeric pixel line-height: http://stackoverflow.com/questions/3614323/jquery-css-line-height-of-normal-px
                    empiricalLineHeight = 1.14 * parseFloat(this.$el.css('font-size'));
                }
                else if (this.$el.css('line-height').indexOf('px') === -1) {
                    empiricalLineHeight = this.$el.css('line-height') * parseFloat(this.$el.css('font-size'));
                } else {
                    empiricalLineHeight = parseFloat(this.$el.css('line-height'));
                }

                if(!isNaN(empiricalLineHeight)) {
                    this.config['lineHeight'] = empiricalLineHeight;
                } else {
                    throw new Error("No \"lineHeight\" parameter was specified and none could be calculated.");
                }
            }

            if('inline' === this.$el.css('display')) {
                if(this.config['contextParent'] === null) {
                    this.config['contextParent'] = closestBlockLevelAncestor(this.$el);
                } else if('inline' === this.config['contextParent'].css('display')) {
                    this.config['contextParent'] = closestBlockLevelAncestor(this.config['contextParent']);
                }
            }

            this.html = this.$el.html();
            this.lastTruncationPoint = null;
        }

        Truncate.prototype = {

            options: function(options) {
                if(typeof options === 'object') {
                    this.config = $.extend(true, { }, this.config, options);
                    return;
                }
                return this.config;
            },

            update: function(updatedHtml) {

                if(typeof updatedHtml === 'undefined') {
                    var elementHtml = this.$el.html();
                    if(typeof this.lastHtmlLength !== 'undefined' && elementHtml.length !== this.lastHtmlLength) {
                        updatedHtml = elementHtml.substring(0,this.lastTruncationPoint) + this.html.substring(this.lastTruncationPoint);
                        this.html = updatedHtml;
                    }
                } else {
                    this.html = updatedHtml;
                }
                this.lastTruncationPoint = truncate(this.$el, this.config, this.html);
                this.lastHtmlLength = this.$el.html().length;
            },

            'getOriginalHtml': function() {
                return this.html;
            }
        };

        $.fn.truncate = function(methodName) {

            var $el = $(this);

            if(typeof methodName === 'undefined' || methodName === null || typeof methodName === 'object') {

                $el.each(function() {
                    var $this = $(this);
                    var plugin = new Truncate($this, methodName);
                    $this.data('truncatePlugin', plugin);
                    plugin.lastTruncationPoint = truncate($this, plugin.config, plugin.html);
                    plugin.lastHtmlLength = $this.html().length;
                });
            }

            var result;
            var methodArgs = arguments;

            if(typeof methodName === 'string') {
                $el.each(function() {
                    var plugin = $(this).data('truncatePlugin');
                    if(typeof plugin[methodName] === 'function') {
                        var newResult = plugin[methodName].apply(plugin, Array.prototype.slice.call(methodArgs, 1));
                        if(typeof result === 'undefined') {
                            result = newResult;
                        }
                    }
                });
            }

            return typeof result !== 'undefined' ? result : this;
        };
    })(jQuery);
}
