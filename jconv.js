/*! ------------------------------------------------------

	Jconv

	Copyright (c) 2013 narirou
	MIT Licensed

------------------------------------------------------- */

'use strict';

var unknown  = '?'.charCodeAt( 0 );
var unknown2 = '・'.charCodeAt( 0 );

var tables = {
	'SJIS':           require( './tables/SJIS' ),
	'JIS':            require( './tables/JIS' ),
	'JISEXT':         require( './tables/JISEXT' ),
	'SJISInverted':   require( './tables/SJISInverted' ),
	'JISInverted':    require( './tables/JISInverted' ),
	'JISEXTInverted': require( './tables/JISEXTInverted' )
};

var encodings = {};

var Encoding = function( obj ) {
	this.name = obj.name;
	this.convert = obj.convert;
};

var jconv = module.exports = function( buf, from, to ) {
	return jconv.convert( buf, from, to );
};

jconv.defineEncoding = function( obj ) {
	encodings[ obj.name ] = new Encoding( obj );
};

jconv.convert = function( buf, from, to ) {
	if( ! to ) {
		throw new Error( 'Encoding not recognized.' );
	}

	from = getName( from );
	to   = getName( to );
	if( from === to ) {
		return buf;
	}

	buf = ensureBuffer( buf );

	// Directly convert if possible.
	var name = from + 'to' + to;
	if( encodings[ name ] ) {
		return encodings[ name ].convert( buf );
	}
	else {
		var uniBuf = encodings[ from + 'toUTF8' ].convert( buf );
		return encodings[ 'UTF8to' + to ].convert( uniBuf );
	}
};

jconv.decode = function( buf, from ) {
	return jconv.convert( buf, from, 'UTF8' ).toString();
};

jconv.encode = function( str, to ) {
	return jconv.convert( str, 'UTF8', to );
};

function getName( name ) {
	if( ! name ) return 'UTF8';
	switch( name.toUpperCase() ) {
		case 'WINDOWS-31J':
		case 'CP932':
		case 'SJIS':
		case 'SHIFTJIS':
		case 'SHIFT_JIS':
			return 'SJIS';
		case 'EUCJP':
		case 'EUC-JP':
			return 'EUCJP';
		case 'JIS':
		case 'ISO2022JP':
		case 'ISO-2022-JP':
		case 'ISO-2022-JP-1':
			return 'JIS';
		case 'UTF8':
		case 'UTF-8':
			return 'UTF8';
		case 'UNICODE':
		case 'UCS2':
		case 'UCS-2':
		case 'UTF16LE':
		case 'UTF-16LE':
			return 'UNICODE';
		default:
			throw new Error( 'Encoding not recognized.' );
	}
}

function ensureBuffer( buf ) {
	buf = buf || new Buffer( 0 );
	return ( buf instanceof Buffer ) ? buf : new Buffer( buf.toString(), 'UTF8' );
}

// Unicode CharCode -> UTF8 Buffer
function setUtf8Buffer( unicode, utf8Buffer, offset ) {
	if( unicode < 0x80 ) {
		utf8Buffer[ offset++ ] = unicode;
	}
	else if( unicode < 0x800 ) {
		utf8Buffer[ offset++ ] = 0xC0 | unicode >>>  6       ;
		utf8Buffer[ offset++ ] = 0x80 | unicode        & 0x3F;
	}
	else if( unicode < 0x10000 ) {
		utf8Buffer[ offset++ ] = 0xE0 | unicode >>> 12       ;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>>  6 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode        & 0x3F;
	}
	else if( unicode < 0x200000 ) {
		utf8Buffer[ offset++ ] = 0xF0 | unicode >>> 18       ;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>> 12 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>>  6 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode        & 0x3F;
	}
	else if( unicode < 0x4000000 ) {
		utf8Buffer[ offset++ ] = 0xF8 | unicode >>> 24       ;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>> 18 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>> 12 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>>  6 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode        & 0x3F;
	}
	else {
		// ( >>>32 ) is not possible in ECMAScript. So use ( /0x40000000 ).
		utf8Buffer[ offset++ ] = 0xFC | unicode  / 0x40000000;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>> 24 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>> 18 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>> 12 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode >>>  6 & 0x3F;
		utf8Buffer[ offset++ ] = 0x80 | unicode        & 0x3F;
	}
	return offset;
}

function setUnicodeBuffer( unicode, unicodeBuffer, offset ) {
	unicodeBuffer[ offset++ ] = unicode & 0xFF;
	unicodeBuffer[ offset++ ] = unicode >> 8;
	return offset;
}

// UNICODE = UTF16LE(noBOM)
// UNICODE -> UTF8
jconv.defineEncoding({
	name: 'UNICODEtoUTF8',

	convert: function( buf ) {
		var setUtf8Buf = setUtf8Buffer;

		var len        = buf.length,
			utf8Buf = new Buffer( len * 3 ),
			offset     = 0,
			unicode;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ],
				buf2 = buf[ i++ ];

			unicode = ( ( buf2 & 0xFF ) << 8 ) + buf1;

			offset = setUtf8Buf( unicode, utf8Buf, offset );
		}
		return utf8Buf.slice( 0, offset );
	}
});

// UNICODE -> SJIS
jconv.defineEncoding({
	name: 'UNICODEtoSJIS',

	convert: function( buf ) {
		var tableSjisInv = tables[ 'SJISInverted' ],
			unknownSjis  = tableSjisInv[ unknown2 ];

		var len     = buf.length,
			sjisBuf = new Buffer( len ),
			offset  = 0,
			unicode;

		for( var i = 0; i <len; ) {
			var buf1 = buf[ i++ ],
				buf2 = buf[ i++ ];

			unicode = ( ( buf2 & 0xFF ) << 8 ) + buf1;

			// ASCII
			if( unicode < 0x80 ) {
				sjisBuf[ offset++ ] = unicode;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xFF61 <= unicode && unicode <= 0xFF9F ) {
				sjisBuf[ offset++ ] = unicode - 0xFEC0;
			}
			// KANJI
			else {
				var code = tableSjisInv[ unicode ] || unknownSjis;
				sjisBuf[ offset++ ] = code >> 8;
				sjisBuf[ offset++ ] = code & 0xFF;
			}
		}
		return sjisBuf.slice( 0, offset );
	}
});

// UNICODE -> JIS
jconv.defineEncoding({
	name: 'UNICODEtoJIS',

	convert: function( buf ) {
		var tableJisInv    = tables[ 'JISInverted' ],
			tableJisExtInv = tables[ 'JISEXTInverted' ],
			unknownJis     = tableJisInv[ unknown2 ];

		var len      = buf.length,
			codeBuf  = new Buffer( len * 3 + 4 ),
			offset   = 0,
			unicode,
			sequence = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ],
				buf2 = buf[ i++ ];

			unicode = ( ( buf2 & 0xFF ) << 8 ) + buf1;

			// ASCII
			if( unicode < 0x80 ) {
				if( sequence !== 0 ) {
					sequence = 0;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x42;
				}
				codeBuf[ offset++ ] = unicode;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xFF61 <= unicode && unicode <= 0xFF9F ) {
				if( sequence !== 1 ) {
					sequence = 1;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x49;
				}
				codeBuf[ offset++ ] = unicode - 0xFF40;
			}
			else {
				var code = tableJisInv[ unicode ];
				if( code ) {
					// KANJI
					if( sequence !== 2 ) {
						sequence = 2;
						codeBuf[ offset++ ] = 0x1B;
						codeBuf[ offset++ ] = 0x24;
						codeBuf[ offset++ ] = 0x42;
					}
					codeBuf[ offset++ ] = code >> 8;
					codeBuf[ offset++ ] = code & 0xFF;
				}
				else {
					var ext = tableJisExtInv[ unicode ];
					if( ext ) {
						// EXTENSION
						if( sequence !== 3 ) {
							sequence = 3;
							codeBuf[ offset++ ] = 0x1B;
							codeBuf[ offset++ ] = 0x24;
							codeBuf[ offset++ ] = 0x28;
							codeBuf[ offset++ ] = 0x44;
						}
						codeBuf[ offset++ ] = ext >> 8;
						codeBuf[ offset++ ] = ext & 0xFF;
					}
					else {
						// UNKNOWN
						if( sequence !== 2 ) {
							sequence = 2;
							codeBuf[ offset++ ] = 0x1B;
							codeBuf[ offset++ ] = 0x24;
							codeBuf[ offset++ ] = 0x42;
						}
						codeBuf[ offset++ ] = unknownJis >> 8;
						codeBuf[ offset++ ] = unknownJis & 0xFF;
					}
				}
			}
		}

		// Add ASCII ESC
		if( sequence !== 0 ) {
			sequence = 0;
			codeBuf[ offset++ ] = 0x1B;
			codeBuf[ offset++ ] = 0x28;
			codeBuf[ offset++ ] = 0x42;
		}

		return codeBuf.slice( 0, offset );
	}
});

// UNICODE -> EUCJP
jconv.defineEncoding({
	name: 'UNICODEtoEUCJP',

	convert: function( buf ) {
		var tableJisInv    = tables[ 'JISInverted' ],
			tableJisExtInv = tables[ 'JISEXTInverted' ],
			unknownJis     = tableJisInv[ unknown2 ];

		var len     = buf.length,
			codeBuf = new Buffer( len * 2 ),
			offset  = 0,
			unicode,
			sequence;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ],
				buf2 = buf[ i++ ];

			unicode = ( ( buf2 & 0xFF ) << 8 ) + buf1;

			// ASCII
			if( unicode < 0x80 ) {
				codeBuf[ offset++ ] = unicode;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xFF61 <= unicode && unicode <= 0xFF9F ) {
				codeBuf[ offset++ ] = 0x8E;
				codeBuf[ offset++ ] = unicode - 0xFFC0;
			}
			else {
				// KANJI
				var jis = tableJisInv[ unicode ];
				if( jis ) {
					codeBuf[ offset++ ] = ( jis >> 8 ) - 0x80;
					codeBuf[ offset++ ] = ( jis & 0xFF ) - 0x80;
				}
				else {
					// EXTENSION
					var ext = tableJisExtInv[ unicode ];
					if( ext ) {
						codeBuf[ offset++ ] = 0x8F;
						codeBuf[ offset++ ] = ( ext >> 8 ) - 0x80;
						codeBuf[ offset++ ] = ( ext & 0xFF ) - 0x80;
					}
					// UNKNOWN
					else {
						codeBuf[ offset++ ] = ( unknownJis >> 8 ) - 0x80;
						codeBuf[ offset++ ] = ( unknownJis & 0xFF ) - 0x80;
					}
				}
			}
		}
		return codeBuf.slice( 0, offset );
	}
});

// UTF8 -> UNICODE
jconv.defineEncoding({
	name: 'UTF8toUNICODE',

	convert: function( buf ) {
		var setUnicodeBuf = setUnicodeBuffer;

		var len        = buf.length,
			unicodeBuf = new Buffer( len * 2 ),
			offset     = 0,
			unicode;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			switch( buf1 >> 4 ) {
				case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
					unicode = buf1;
				break;
				case 12: case 13:
					unicode = (buf1 & 0x1F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				case 14:
					unicode = (buf1 & 0x0F) << 12 | (buf[ i++ ] & 0x3F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				default:
					unicode = (buf1 & 0x07) << 18 | (buf[ i++ ] & 0x3F) << 12 | (buf[ i++ ] & 0x3F) << 6 | buf[ i++ ] & 0x3F;
				break;
			}
			offset = setUnicodeBuf( unicode, unicodeBuf, offset );
		}
		return unicodeBuf.slice( 0, offset );
	}
});

// UTF8 -> SJIS
jconv.defineEncoding({
	name: 'UTF8toSJIS',

	convert: function( buf ) {
		var tableSjisInv = tables[ 'SJISInverted' ],
			unknownSjis  = tableSjisInv[ unknown2 ];

		var len     = buf.length,
			sjisBuf = new Buffer( len * 2 ),
			offset  = 0,
			unicode;

		for( var i = 0; i <len; ) {
			var buf1 = buf[ i++ ];

			switch( buf1 >> 4 ) {
				case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
					unicode = buf1;
				break;
				case 12: case 13:
					unicode = (buf1 & 0x1F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				case 14:
					unicode = (buf1 & 0x0F) << 12 | (buf[ i++ ] & 0x3F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				default:
					unicode = (buf1 & 0x07) << 18 | (buf[ i++ ] & 0x3F) << 12 | (buf[ i++ ] & 0x3F) << 6 | buf[ i++ ] & 0x3F;
				break;
			}

			// ASCII
			if( unicode < 0x80 ) {
				sjisBuf[ offset++ ] = unicode;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xFF61 <= unicode && unicode <= 0xFF9F ) {
				sjisBuf[ offset++ ] = unicode - 0xFEC0;
			}
			// KANJI
			else {
				var code = tableSjisInv[ unicode ] || unknownSjis;
				sjisBuf[ offset++ ] = code >> 8;
				sjisBuf[ offset++ ] = code & 0xFF;
			}
		}
		return sjisBuf.slice( 0, offset );
	}
});

// UTF8 -> JIS
jconv.defineEncoding({
	name: 'UTF8toJIS',

	convert: function( buf ) {
		var tableJisInv    = tables[ 'JISInverted' ],
			tableJisExtInv = tables[ 'JISEXTInverted' ],
			unknownJis     = tableJisInv[ unknown2 ];

		var len      = buf.length,
			codeBuf  = new Buffer( len * 3 + 4 ),
			offset   = 0,
			unicode,
			sequence = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			switch( buf1 >> 4 ) {
				case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
					unicode = buf1;
				break;
				case 12: case 13:
					unicode = (buf1 & 0x1F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				case 14:
					unicode = (buf1 & 0x0F) << 12 | (buf[ i++ ] & 0x3F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				default:
					unicode = (buf1 & 0x07) << 18 | (buf[ i++ ] & 0x3F) << 12 | (buf[ i++ ] & 0x3F) << 6 | buf[ i++ ] & 0x3F;
				break;
			}

			// ASCII
			if( unicode < 0x80 ) {
				if( sequence !== 0 ) {
					sequence = 0;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x42;
				}
				codeBuf[ offset++ ] = unicode;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xFF61 <= unicode && unicode <= 0xFF9F ) {
				if( sequence !== 1 ) {
					sequence = 1;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x49;
				}
				codeBuf[ offset++ ] = unicode - 0xFF40;
			}
			else {
				var code = tableJisInv[ unicode ];
				if( code ) {
					// KANJI
					if( sequence !== 2 ) {
						sequence = 2;
						codeBuf[ offset++ ] = 0x1B;
						codeBuf[ offset++ ] = 0x24;
						codeBuf[ offset++ ] = 0x42;
					}
					codeBuf[ offset++ ] = code >> 8;
					codeBuf[ offset++ ] = code & 0xFF;
				}
				else {
					var ext = tableJisExtInv[ unicode ];
					if( ext ) {
						// EXTENSION
						if( sequence !== 3 ) {
							sequence = 3;
							codeBuf[ offset++ ] = 0x1B;
							codeBuf[ offset++ ] = 0x24;
							codeBuf[ offset++ ] = 0x28;
							codeBuf[ offset++ ] = 0x44;
						}
						codeBuf[ offset++ ] = ext >> 8;
						codeBuf[ offset++ ] = ext & 0xFF;
					}
					else {
						// UNKNOWN
						if( sequence !== 2 ) {
							sequence = 2;
							codeBuf[ offset++ ] = 0x1B;
							codeBuf[ offset++ ] = 0x24;
							codeBuf[ offset++ ] = 0x42;
						}
						codeBuf[ offset++ ] = unknownJis >> 8;
						codeBuf[ offset++ ] = unknownJis & 0xFF;
					}
				}
			}
		}

		// Add ASCII ESC
		if( sequence !== 0 ) {
			sequence = 0;
			codeBuf[ offset++ ] = 0x1B;
			codeBuf[ offset++ ] = 0x28;
			codeBuf[ offset++ ] = 0x42;
		}
		return codeBuf.slice( 0, offset );
	}
});

// UTF8 -> EUCJP
jconv.defineEncoding({
	name: 'UTF8toEUCJP',

	convert: function( buf ) {
		var tableJisInv    = tables[ 'JISInverted' ],
			tableJisExtInv = tables[ 'JISEXTInverted' ],
			unknownJis     = tableJisInv[ unknown2 ];

		var len     = buf.length,
			codeBuf = new Buffer( len * 2 ),
			offset  = 0,
			unicode,
			sequence;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			switch( buf1 >> 4 ) {
				case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
					unicode = buf1;
				break;
				case 12: case 13:
					unicode = (buf1 & 0x1F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				case 14:
					unicode = (buf1 & 0x0F) << 12 | (buf[ i++ ] & 0x3F) <<  6 | buf[ i++ ] & 0x3F;
				break;
				default:
					unicode = (buf1 & 0x07) << 18 | (buf[ i++ ] & 0x3F) << 12 | (buf[ i++ ] & 0x3F) << 6 | buf[ i++ ] & 0x3F;
				break;
			}

			// ASCII
			if( unicode < 0x80 ) {
				codeBuf[ offset++ ] = unicode;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xFF61 <= unicode && unicode <= 0xFF9F ) {
				codeBuf[ offset++ ] = 0x8E;
				codeBuf[ offset++ ] = unicode - 0xFFC0;
			}
			else {
				// KANJI
				var jis = tableJisInv[ unicode ];
				if( jis ) {
					codeBuf[ offset++ ] = ( jis >> 8 ) - 0x80;
					codeBuf[ offset++ ] = ( jis & 0xFF ) - 0x80;
				}
				else {
					// EXTENSION
					var ext = tableJisExtInv[ unicode ];
					if( ext ) {
						codeBuf[ offset++ ] = 0x8F;
						codeBuf[ offset++ ] = ( ext >> 8 ) - 0x80;
						codeBuf[ offset++ ] = ( ext & 0xFF ) - 0x80;
					}
					// UNKNOWN
					else {
						codeBuf[ offset++ ] = ( unknownJis >> 8 ) - 0x80;
						codeBuf[ offset++ ] = ( unknownJis & 0xFF ) - 0x80;
					}
				}
			}
		}
		return codeBuf.slice( 0, offset );
	}
});

// SJIS -> UNICODE
jconv.defineEncoding({
	name: 'SJIStoUNICODE',

	convert: function( buf ) {
		var tableSjis     = tables[ 'SJIS' ],
			setUnicodeBuf = setUnicodeBuffer;

		var len        = buf.length,
			unicodeBuf = new Buffer( len * 3 ),
			offset     = 0,
			unicode;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				unicode = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xA0 <= buf1 && buf1 <= 0xDF ) {
				unicode = buf1 + 0xFEC0;
			}
			// KANJI
			else {
				var code = ( buf1 << 8 ) + buf[ i++ ];
				unicode  = tableSjis[ code ] || unknown2;
			}
			offset = setUnicodeBuf( unicode, unicodeBuf, offset );
		}
		return unicodeBuf.slice( 0, offset );
	}
});

// SJIS -> UTF8
jconv.defineEncoding({
	name: 'SJIStoUTF8',

	convert: function( buf ) {
		var tableSjis = tables[ 'SJIS' ],
			setUtf8Buf = setUtf8Buffer;

		var len     = buf.length,
			utf8Buf = new Buffer( len * 3 ),
			offset  = 0,
			unicode;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				unicode = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xA0 <= buf1 && buf1 <= 0xDF ) {
				unicode = buf1 + 0xFEC0;
			}
			// KANJI
			else {
				var code = ( buf1 << 8 ) + buf[ i++ ];
				unicode  = tableSjis[ code ] || unknown2;
			}
			offset = setUtf8Buf( unicode, utf8Buf, offset );
		}
		return utf8Buf.slice( 0, offset );
	}
});

// SJIS -> JIS
jconv.defineEncoding({
	name: 'SJIStoJIS',

	convert: function( buf ) {
		var tableSjis   = tables[ 'SJIS' ],
			tableJisInv = tables[ 'JISInverted' ];

		var len      = buf.length,
			codeBuf  = new Buffer( len * 3 + 4 ),
			offset   = 0,
			sequence = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				if( sequence !== 0 ) {
					sequence = 0;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x42;
				}
				codeBuf[ offset++ ] = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xA1 <= buf1 && buf1 <= 0xDF ) {
				if( sequence !== 1 ) {
					sequence = 1;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x49;
				}
				codeBuf[ offset++ ] = buf1 - 0x80;
			}
			// KANJI
			else if( buf1 <= 0xEE ) {
				if( sequence !== 2 ) {
					sequence = 2;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x24;
					codeBuf[ offset++ ] = 0x42;
				}
				var buf2 = buf[ i++ ];
				buf1 <<= 1;
				if( buf2 < 0x9F ) {
					if( buf1 < 0x13F ) {
						buf1 -= 0xE1;
					}
					else {
						buf1 -= 0x61;
					}
					if( buf2 > 0x7E ) {
						buf2 -= 0x20;
					}
					else {
						buf2 -= 0x1F;
					}
				}
				else {
					if( buf1 < 0x13F ) {
						buf1 -= 0xE0;
					}
					else {
						buf1 -= 0x60;
					}
					buf2 -= 0x7E;
				}
				codeBuf[ offset++ ] = buf1;
				codeBuf[ offset++ ] = buf2;
			}
			// IBM EXTENSION -> the other
			else if( buf1 >= 0xFA ) {
				if( sequence !== 2 ) {
					sequence = 2;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x24;
					codeBuf[ offset++ ] = 0x42;
				}
				var sjis    = ( buf1 << 8 ) + buf[ i++ ],
					unicode = tableSjis[ sjis ] || unknown2,
					code    = tableJisInv[ unicode ];

				codeBuf[ offset++ ] = code >> 8;
				codeBuf[ offset++ ] = code & 0xFF;
			}
		}

		// Add ASCII ESC
		if( sequence !== 0 ) {
			sequence = 0;
			codeBuf[ offset++ ] = 0x1B;
			codeBuf[ offset++ ] = 0x28;
			codeBuf[ offset++ ] = 0x42;
		}
		return codeBuf.slice( 0, offset );
	}
});

// SJIS -> EUCJP
jconv.defineEncoding({
	name: 'SJIStoEUCJP',

	convert: function( buf ) {
		var tableSjis   = tables[ 'SJIS' ],
			tableJisInv = tables[ 'JISInverted' ];

		var len     = buf.length,
			codeBuf = new Buffer( len * 2 ),
			offset  = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				codeBuf[ offset++ ] = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( 0xA1 <= buf1 && buf1 <= 0xDF ) {
				codeBuf[ offset++ ] = 0x8E;
				codeBuf[ offset++ ] = buf1;
			}
			// KANJI
			else if( buf1 <= 0xEE ) {
				var buf2 = buf[ i++ ];
				buf1 <<= 1;
				if( buf2 < 0x9F ) {
					if( buf1 < 0x13F ) {
						buf1 -= 0x61;
					}
					else {
						buf1 -= 0xE1;
					}
					if( buf2 > 0x7E ) {
						buf2 += 0x60;
					}
					else {
						buf2 += 0x61;
					}
				}
				else {
					if( buf1 < 0x13F ) {
						buf1 -= 0x60;
					}
					else {
						buf1 -= 0xE0;
					}
					buf2 += 0x02;
				}
				codeBuf[ offset++ ] = buf1;
				codeBuf[ offset++ ] = buf2;
			}
			// IBM EXTENSION -> the other
			else if( buf1 >= 0xFA ) {
				var sjis    = ( buf1 << 8 ) + buf[ i++ ],
					unicode = tableSjis[ sjis ] || unknown2,
					jis     = tableJisInv[ unicode ];

				codeBuf[ offset++ ] = ( jis >> 8 ) - 0x80;
				codeBuf[ offset++ ] = ( jis & 0xFF ) - 0x80;
			}
		}
		return codeBuf.slice( 0, offset );
	}
});

// JIS -> UNICODE
jconv.defineEncoding({
	name: 'JIStoUNICODE',

	convert: function( buf ) {
		var tableJis      = tables[ 'JIS' ],
			tableJisExt   = tables[ 'JISEXT' ],
			setUnicodeBuf = setUnicodeBuffer;

		var len        = buf.length,
			unicodeBuf = new Buffer( len * 2 ),
			offset     = 0,
			unicode,
			sequence   = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ESC Sequence
			if( buf1 === 0x1b ) {
				var buf2 = buf[ i++ ],
					buf3 = buf[ i++ ];
				switch( buf2 ) {
					case 0x28:
						if( buf3 === 0x42 || buf === 0xA1 ) {
							sequence = 0;
						}
						else if( buf3 === 0x49 ) {
							sequence = 1;
						}
					break;
					case 0x26:
						sequence = 2;
						i += 3;
					break;
					case 0x24:
						if( buf3 === 0x40 || buf3 === 0x42 ) {
							sequence = 2;
						}
						else if( buf3 === 0x28 ) {
							sequence = 3;
							i++;
						}
					break;
				}
				continue;
			}

			switch( sequence ) {
				// ASCII
				case 0:
					unicode = buf1;
				break;
				// HALFWIDTH_KATAKANA
				case 1:
					unicode = buf1 + 0xFF40;
				break;
				// KANJI
				case 2:
					var code = ( buf1 << 8 ) + buf[ i++ ];
					unicode  = tableJis[ code ] || unknown2;
				break;
				// EXTENSION
				case 3:
					var code = ( buf1 << 8 ) + buf[ i++ ];
					unicode  = tableJisExt[ code ] || unknown2;
				break;
			}
			offset = setUnicodeBuf( unicode, unicodeBuf, offset );
		}
		return unicodeBuf.slice( 0, offset );
	}
});

// JIS -> UTF8
jconv.defineEncoding({
	name: 'JIStoUTF8',

	convert: function( buf ) {
		var tableJis    = tables[ 'JIS' ],
			tableJisExt = tables[ 'JISEXT' ],
			setUtf8Buf   = setUtf8Buffer;

		var len      = buf.length,
			utf8Buf  = new Buffer( len * 2 ),
			offset   = 0,
			unicode,
			sequence = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ESC Sequence
			if( buf1 === 0x1b ) {
				var buf2 = buf[ i++ ],
					buf3 = buf[ i++ ];
				switch( buf2 ) {
					case 0x28:
						if( buf3 === 0x42 || buf === 0xA1 ) {
							sequence = 0;
						}
						else if( buf3 === 0x49 ) {
							sequence = 1;
						}
					break;
					case 0x26:
						sequence = 2;
						i += 3;
					break;
					case 0x24:
						if( buf3 === 0x40 || buf3 === 0x42 ) {
							sequence = 2;
						}
						else if( buf3 === 0x28 ) {
							sequence = 3;
							i++;
						}
					break;
				}
				continue;
			}

			switch( sequence ) {
				// ASCII
				case 0:
					unicode = buf1;
				break;
				// HALFWIDTH_KATAKANA
				case 1:
					unicode = buf1 + 0xFF40;
				break;
				// KANJI
				case 2:
					var code = ( buf1 << 8 ) + buf[ i++ ];
					unicode  = tableJis[ code ] || unknown2;
				break;
				// EXTENSION
				case 3:
					var code = ( buf1 << 8 ) + buf[ i++ ];
					unicode  = tableJisExt[ code ] || unknown2;
				break;
			}
			offset = setUtf8Buf( unicode, utf8Buf, offset );
		}
		return utf8Buf.slice( 0, offset );
	}
});

// JIS -> SJIS
jconv.defineEncoding({
	name: 'JIStoSJIS',

	convert: function( buf ) {
		var tableSjis    = tables[ 'SJIS' ],
			tableSjisInv = tables[ 'SJISInverted' ],
			unknownSjis  = tableSjisInv[ unknown2 ];

		var len      = buf.length,
			codeBuf  = new Buffer( len * 2 ),
			offset   = 0,
			sequence = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ESC Sequence
			if( buf1 === 0x1b ) {
				var buf2 = buf[ i++ ],
					buf3 = buf[ i++ ];
				switch( buf2 ) {
					case 0x28:
						if( buf3 === 0x42 || buf === 0xA1 ) {
							sequence = 0;
						}
						else if( buf3 === 0x49 ) {
							sequence = 1;
						}
					break;
					case 0x26:
						sequence = 2;
						i += 3;
					break;
					case 0x24:
						if( buf3 === 0x40 || buf3 === 0x42 ) {
							sequence = 2;
						}
						else if( buf3 === 0x28 ) {
							sequence = 3;
							i++;
						}
					break;
				}
				continue;
			}

			switch( sequence ) {
				// ASCII
				case 0:
					codeBuf[ offset++ ] = buf1;
				break;
				// HALFWIDTH_KATAKANA
				case 1:
					codeBuf[ offset++ ] = buf1 + 0x80;
				break;
				// KANJI
				case 2:
					var buf2 = buf[ i++ ];
					if( buf1 & 0x01 ) {
						buf1 >>= 1;
						if( buf1 < 0x2F ) {
							buf1 += 0x71;
						}
						else {
							buf1 -= 0x4F;
						}
						if( buf2 > 0x5F ) {
							buf2 += 0x20;
						}
						else {
							buf2 += 0x1F;
						}
					}
					else {
						buf1 >>= 1;
						if( buf1 <= 0x2F ) {
							buf1 += 0x70;
						}
						else {
							buf1 -= 0x50;
						}
						buf2 += 0x7E;
					}
					// NEC SELECT IBM EXTENSION -> IBM EXTENSION.
					var sjis = ( (buf1 & 0xFF) << 8 ) + buf2;
					if( 0xED40 <= sjis && sjis <= 0xEEFC ) {
						var unicode   = tableSjis[ sjis ],
							sjisFixed = tableSjisInv[ unicode ] || unknownSjis;

						buf1 = sjisFixed >> 8;
						buf2 = sjisFixed & 0xFF;
					}
					codeBuf[ offset++ ] = buf1;
					codeBuf[ offset++ ] = buf2;
				break;
				// EXTENSION
				case 3:
					codeBuf[ offset++ ] = unknownSjis >> 8;
					codeBuf[ offset++ ] = unknownSjis & 0xFF;
					i++;
				break;
			}
		}
		return codeBuf.slice( 0, offset );
	}
});

// JIS -> EUCJP
jconv.defineEncoding({
	name: 'JIStoEUCJP',

	convert: function( buf ) {
		var len      = buf.length,
			codeBuf  = new Buffer( len * 2 ),
			offset   = 0,
			sequence = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ESC Sequence
			if( buf1 === 0x1b ) {
				var buf2 = buf[ i++ ],
					buf3 = buf[ i++ ];
				switch( buf2 ) {
					case 0x28:
						if( buf3 === 0x42 || buf === 0xA1 ) {
							sequence = 0;
						}
						else if( buf3 === 0x49 ) {
							sequence = 1;
						}
					break;
					case 0x26:
						sequence = 2;
						i += 3;
					break;
					case 0x24:
						if( buf3 === 0x40 || buf3 === 0x42 ) {
							sequence = 2;
						}
						else if( buf3 === 0x28 ) {
							sequence = 3;
							i++;
						}
					break;
				}
				continue;
			}

			switch( sequence ) {
				// ASCII
				case 0:
					codeBuf[ offset++ ] = buf1;
				break;
				// HALFWIDTH_KATAKANA
				case 1:
					codeBuf[ offset++ ] = 0x8E;
					codeBuf[ offset++ ] = buf1 + 0x80;
				break;
				// KANJI
				case 2:
					codeBuf[ offset++ ] = buf1 + 0x80;
					codeBuf[ offset++ ] = buf[ i++ ] + 0x80;
				break;
				// EXTENSION
				case 3:
					codeBuf[ offset++ ] = 0x8F;
					codeBuf[ offset++ ] = buf1 + 0x80;
					codeBuf[ offset++ ] = buf[ i++ ] + 0x80;
				break;
			}
		}
		return codeBuf.slice( 0, offset );
	}
});

// EUCJP -> UNICODE
jconv.defineEncoding({
	name: 'EUCJPtoUNICODE',

	convert: function( buf ) {
		var tableJis      = tables[ 'JIS' ],
			tableJisExt   = tables[ 'JISEXT' ],
			setUnicodeBuf = setUnicodeBuffer;

		var len        = buf.length,
			unicodeBuf = new Buffer( len * 2 ),
			offset     = 0,
			unicode;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				unicode = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( buf1 === 0x8E ) {
				unicode = buf[ i++ ] + 0xFEC0;
			}
			// EXTENSION
			else if( buf1 === 0x8F ) {
				var jisbuf2 = buf[ i++ ] - 0x80,
					jisbuf3 = buf[ i++ ] - 0x80,
					jis = ( jisbuf2 << 8 ) + jisbuf3;
				unicode = tableJisExt[ jis ] || unknown2;
			}
			// KANJI
			else {
				var jisbuf1 = buf1 - 0x80,
					jisbuf2 = buf[ i++ ] - 0x80,
					jis = ( jisbuf1 << 8 ) + jisbuf2;
				unicode = tableJis[ jis ] || unknown2;
			}
			offset = setUnicodeBuf( unicode, unicodeBuf, offset );
		}
		return unicodeBuf.slice( 0, offset );
	}
});

// EUCJP -> UTF8
jconv.defineEncoding({
	name: 'EUCJPtoUTF8',

	convert: function( buf ) {
		var tableJis    = tables[ 'JIS' ],
			tableJisExt = tables[ 'JISEXT' ],
			setUtf8Buf   = setUtf8Buffer;

		var len     = buf.length,
			utf8Buf = new Buffer( len * 2 ),
			offset  = 0,
			unicode;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				unicode = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( buf1 === 0x8E ) {
				unicode = buf[ i++ ] + 0xFEC0;
			}
			// EXTENSION
			else if( buf1 === 0x8F ) {
				var jisbuf2 = buf[ i++ ] - 0x80,
					jisbuf3 = buf[ i++ ] - 0x80,
					jis = ( jisbuf2 << 8 ) + jisbuf3;
				unicode = tableJisExt[ jis ] || unknown2;
			}
			// KANJI
			else {
				var jisbuf1 = buf1 - 0x80,
					jisbuf2 = buf[ i++ ] - 0x80,
					jis = ( jisbuf1 << 8 ) + jisbuf2;
				unicode = tableJis[ jis ] || unknown2;
			}
			offset = setUtf8Buf( unicode, utf8Buf, offset );
		}
		return utf8Buf.slice( 0, offset );
	}
});

// EUCJP -> SJIS
jconv.defineEncoding({
	name: 'EUCJPtoSJIS',
	unknown: tables[ 'SJISInverted' ][ unknown2 ],

	convert: function( buf ) {
		var tableSjis    = tables[ 'SJIS' ],
			tableSjisInv = tables[ 'SJISInverted' ],
			unknownSjis  = tableSjisInv[ unknown2 ];

		var len     = buf.length,
			codeBuf = new Buffer( len * 2 ),
			offset  = 0,
			sequence;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				codeBuf[ offset++ ] = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( buf1 === 0x8E ) {
				codeBuf[ offset++ ] = buf[ i++ ];
			}
			// EXTENSION
			else if( buf1 === 0x8F ) {
				codeBuf[ offset++ ] = unknownSjis >> 8;
				codeBuf[ offset++ ] = unknownSjis & 0xFF;
				i += 2;
			}
			// KANJI
			else {
				var buf2 = buf[ i++ ];
				if( buf1 & 0x01 ) {
					buf1 >>= 1;
					if( buf1 < 0x6F ) {
						buf1 += 0x31;
					}
					else {
						buf1 += 0x71;
					}
					if( buf2 > 0xDF ) {
						buf2 -= 0x60;
					}
					else {
						buf2 -= 0x61;
					}
				}
				else {
					buf1 >>= 1;
					if( buf1 <= 0x6F ) {
						buf1 += 0x30;
					}
					else {
						buf1 += 0x70;
					}
					buf2 -= 0x02;
				}
				// NEC SELECT IBM EXTENSION -> IBM EXTENSION.
				var sjis = ( (buf1 & 0xFF) << 8 ) + buf2;
				if( 0xED40 <= sjis && sjis <= 0xEEFC ) {
					var unicode   = tableSjis[ sjis ],
						sjisFixed = tableSjisInv[ unicode ] || unknownSjis;

					buf1 = sjisFixed >> 8;
					buf2 = sjisFixed & 0xFF;
				}
				codeBuf[ offset++ ] = buf1;
				codeBuf[ offset++ ] = buf2;
			}
		}
		return codeBuf.slice( 0, offset );
	}
});

// EUCJP -> JIS
jconv.defineEncoding({
	name: 'EUCJPtoJIS',

	convert: function( buf ) {
		var len      = buf.length,
			codeBuf  = new Buffer( len * 3 + 4 ),
			offset   = 0,
			sequence = 0;

		for( var i = 0; i < len; ) {
			var buf1 = buf[ i++ ];

			// ASCII
			if( buf1 < 0x80 ) {
				if( sequence !== 0 ) {
					sequence = 0;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x42;
				}
				codeBuf[ offset++ ] = buf1;
			}
			// HALFWIDTH_KATAKANA
			else if( buf1 === 0x8E ) {
				if( sequence !== 1 ) {
					sequence = 1;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x49;
				}
				codeBuf[ offset++ ] = buf[ i++ ] - 0x80;
			}
			// EXTENSION
			else if( buf1 === 0x8F ) {
				if( sequence !== 3 ) {
					sequence = 3;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x24;
					codeBuf[ offset++ ] = 0x28;
					codeBuf[ offset++ ] = 0x44;
				}
				codeBuf[ offset++ ] = buf[ i++ ] - 0x80;
				codeBuf[ offset++ ] = buf[ i++ ] - 0x80;
			}
			// KANJI
			else {
				if( sequence !== 2 ) {
					sequence = 2;
					codeBuf[ offset++ ] = 0x1B;
					codeBuf[ offset++ ] = 0x24;
					codeBuf[ offset++ ] = 0x42;
				}
				codeBuf[ offset++ ] = buf1 - 0x80;
				codeBuf[ offset++ ] = buf[ i++ ] - 0x80;
			}
		}

		// Add ASCII ESC
		if( sequence !== 0 ) {
			sequence = 0;
			codeBuf[ offset++ ] = 0x1B;
			codeBuf[ offset++ ] = 0x28;
			codeBuf[ offset++ ] = 0x42;
		}
		return codeBuf.slice( 0, offset );
	}
});
