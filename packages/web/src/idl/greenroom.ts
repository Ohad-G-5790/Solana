/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/greenroom.json`.
 */
export type Greenroom = {
  "address": "4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8",
  "metadata": {
    "name": "greenroom",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptShow",
      "docs": [
        "Venue agent accepts a proposed show; tickets go on sale."
      ],
      "discriminator": [
        249,
        64,
        113,
        20,
        88,
        192,
        176,
        114
      ],
      "accounts": [
        {
          "name": "venueAuthority",
          "signer": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "show",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "addPayee",
      "docs": [
        "Band agent adds a crew/service payee, carving its share out of the band's split."
      ],
      "discriminator": [
        248,
        28,
        137,
        95,
        9,
        128,
        223,
        82
      ],
      "accounts": [
        {
          "name": "bandAuthority",
          "signer": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "show",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "pubkey"
        },
        {
          "name": "bps",
          "type": "u16"
        },
        {
          "name": "label",
          "type": "string"
        }
      ]
    },
    {
      "name": "buyTicket",
      "docs": [
        "Pay for tickets into the show's escrow. `beneficiary` receives any refund."
      ],
      "discriminator": [
        11,
        24,
        17,
        193,
        168,
        116,
        164,
        169
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Pays the tickets and the ticket account rent. May be a fan's own wallet",
            "or a hub wallet buying on behalf of `beneficiary`."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "show",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "show"
              }
            ]
          }
        },
        {
          "name": "ticket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "show"
              },
              {
                "kind": "arg",
                "path": "beneficiary"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "quantity",
          "type": "u16"
        },
        {
          "name": "beneficiary",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "checkThreshold",
      "docs": [
        "Permissionless: confirm the show once the threshold is met, or cancel it",
        "once the deadline passed without reaching it."
      ],
      "discriminator": [
        225,
        18,
        237,
        20,
        171,
        51,
        192,
        183
      ],
      "accounts": [
        {
          "name": "show",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "createTour",
      "docs": [
        "Open a tour: a date window and region the band agent will fill with shows."
      ],
      "discriminator": [
        66,
        122,
        110,
        238,
        201,
        184,
        48,
        114
      ],
      "accounts": [
        {
          "name": "bandAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "bandProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "bandAuthority"
              }
            ]
          }
        },
        {
          "name": "tour",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  117,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "bandProfile"
              },
              {
                "kind": "arg",
                "path": "tourId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tourId",
          "type": "u32"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "startsAt",
          "type": "i64"
        },
        {
          "name": "endsAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "proposeShow",
      "docs": [
        "Band agent proposes a show at a venue with price, capacity, threshold and split."
      ],
      "discriminator": [
        208,
        27,
        214,
        233,
        236,
        141,
        176,
        201
      ],
      "accounts": [
        {
          "name": "bandAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "bandProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "bandAuthority"
              }
            ]
          },
          "relations": [
            "tour"
          ]
        },
        {
          "name": "tour",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  117,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "bandProfile"
              },
              {
                "kind": "account",
                "path": "tour.tourId",
                "account": "tour"
              }
            ]
          }
        },
        {
          "name": "venueProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  110,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "venueProfile.authority",
                "account": "venueProfile"
              }
            ]
          }
        },
        {
          "name": "show",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  104,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "tour"
              },
              {
                "kind": "account",
                "path": "venueProfile"
              },
              {
                "kind": "arg",
                "path": "date"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Escrow vault: a system-owned PDA that only this program can sign for."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "show"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "date",
          "type": "i64"
        },
        {
          "name": "ticketPriceLamports",
          "type": "u64"
        },
        {
          "name": "capacity",
          "type": "u32"
        },
        {
          "name": "thresholdBps",
          "type": "u16"
        },
        {
          "name": "thresholdDeadline",
          "type": "i64"
        },
        {
          "name": "bandBps",
          "type": "u16"
        },
        {
          "name": "venueBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "refundTicket",
      "docs": [
        "Permissionless: refund one ticket of a cancelled show to its beneficiary."
      ],
      "discriminator": [
        178,
        97,
        75,
        218,
        227,
        28,
        21,
        73
      ],
      "accounts": [
        {
          "name": "show",
          "writable": true,
          "relations": [
            "ticket"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "show"
              }
            ]
          }
        },
        {
          "name": "ticket",
          "writable": true
        },
        {
          "name": "buyer",
          "writable": true,
          "relations": [
            "ticket"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "registerBand",
      "docs": [
        "Create the band's profile (its on-chain track record starts at zero)."
      ],
      "discriminator": [
        164,
        67,
        17,
        143,
        212,
        142,
        229,
        105
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "bandProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "genre",
          "type": "string"
        }
      ]
    },
    {
      "name": "registerVenue",
      "docs": [
        "Create a venue profile with location and standing capacity."
      ],
      "discriminator": [
        116,
        155,
        199,
        243,
        228,
        180,
        176,
        173
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "venueProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  110,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "city",
          "type": "string"
        },
        {
          "name": "latE6",
          "type": "i32"
        },
        {
          "name": "lngE6",
          "type": "i32"
        },
        {
          "name": "capacity",
          "type": "u32"
        }
      ]
    },
    {
      "name": "rejectShow",
      "docs": [
        "Venue agent rejects a proposed show; the account and vault float go back to the band."
      ],
      "discriminator": [
        98,
        211,
        172,
        21,
        44,
        179,
        21,
        29
      ],
      "accounts": [
        {
          "name": "venueAuthority",
          "signer": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "bandAuthority",
          "docs": [
            "Receives the show account rent and the vault float back."
          ],
          "writable": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "show",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "show"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "settleShow",
      "docs": [
        "Permissionless: after the show date, split the escrow between band, venue and payees."
      ],
      "discriminator": [
        73,
        203,
        237,
        98,
        152,
        25,
        219,
        119
      ],
      "accounts": [
        {
          "name": "show",
          "writable": true
        },
        {
          "name": "bandProfile",
          "writable": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "venueProfile",
          "writable": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "bandAuthority",
          "writable": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "venueAuthority",
          "writable": true,
          "relations": [
            "show"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "show"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "bandProfile",
      "discriminator": [
        30,
        82,
        126,
        201,
        225,
        188,
        124,
        31
      ]
    },
    {
      "name": "show",
      "discriminator": [
        171,
        128,
        239,
        156,
        241,
        58,
        221,
        199
      ]
    },
    {
      "name": "ticket",
      "discriminator": [
        41,
        228,
        24,
        165,
        78,
        90,
        235,
        200
      ]
    },
    {
      "name": "tour",
      "discriminator": [
        32,
        134,
        56,
        242,
        226,
        108,
        129,
        105
      ]
    },
    {
      "name": "venueProfile",
      "discriminator": [
        82,
        115,
        200,
        82,
        205,
        23,
        64,
        160
      ]
    }
  ],
  "events": [
    {
      "name": "bandRegistered",
      "discriminator": [
        254,
        150,
        204,
        144,
        253,
        151,
        72,
        207
      ]
    },
    {
      "name": "payeeAdded",
      "discriminator": [
        3,
        246,
        5,
        50,
        2,
        252,
        12,
        195
      ]
    },
    {
      "name": "showAccepted",
      "discriminator": [
        14,
        174,
        3,
        29,
        97,
        26,
        147,
        211
      ]
    },
    {
      "name": "showCancelled",
      "discriminator": [
        68,
        123,
        38,
        163,
        199,
        39,
        17,
        175
      ]
    },
    {
      "name": "showConfirmed",
      "discriminator": [
        88,
        3,
        91,
        20,
        189,
        255,
        211,
        32
      ]
    },
    {
      "name": "showProposed",
      "discriminator": [
        188,
        69,
        37,
        225,
        92,
        71,
        139,
        83
      ]
    },
    {
      "name": "showRejected",
      "discriminator": [
        212,
        164,
        36,
        241,
        97,
        88,
        170,
        251
      ]
    },
    {
      "name": "showSettled",
      "discriminator": [
        151,
        198,
        71,
        254,
        151,
        96,
        136,
        63
      ]
    },
    {
      "name": "ticketBought",
      "discriminator": [
        80,
        244,
        35,
        181,
        211,
        143,
        3,
        166
      ]
    },
    {
      "name": "ticketRefunded",
      "discriminator": [
        46,
        173,
        213,
        43,
        145,
        205,
        132,
        218
      ]
    },
    {
      "name": "tourCreated",
      "discriminator": [
        11,
        30,
        100,
        141,
        132,
        151,
        94,
        31
      ]
    },
    {
      "name": "venueRegistered",
      "discriminator": [
        86,
        82,
        191,
        91,
        171,
        241,
        178,
        9
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "The signer is not the authority for this account"
    },
    {
      "code": 6001,
      "name": "invalidState",
      "msg": "The show is not in a state that allows this action"
    },
    {
      "code": 6002,
      "name": "tooEarly",
      "msg": "Too early: the threshold deadline or show date has not passed yet"
    },
    {
      "code": 6003,
      "name": "salesClosed",
      "msg": "Ticket sales are closed for this show"
    },
    {
      "code": 6004,
      "name": "soldOut",
      "msg": "Not enough capacity left for this purchase"
    },
    {
      "code": 6005,
      "name": "invalidQuantity",
      "msg": "Quantity must be between 1 and MAX_TICKETS_PER_PURCHASE"
    },
    {
      "code": 6006,
      "name": "invalidSplit",
      "msg": "Payout split must sum to 10000 bps and every part must be positive"
    },
    {
      "code": 6007,
      "name": "invalidThreshold",
      "msg": "Threshold must be between 1 and 10000 bps"
    },
    {
      "code": 6008,
      "name": "invalidDates",
      "msg": "Dates are inconsistent (show outside tour window or deadline after show)"
    },
    {
      "code": 6009,
      "name": "capacityExceedsVenue",
      "msg": "Requested capacity exceeds the venue capacity"
    },
    {
      "code": 6010,
      "name": "invalidPrice",
      "msg": "Ticket price must be greater than zero"
    },
    {
      "code": 6011,
      "name": "alreadyRefunded",
      "msg": "This ticket was already refunded"
    },
    {
      "code": 6012,
      "name": "tooManyPayees",
      "msg": "The show already has the maximum number of payees"
    },
    {
      "code": 6013,
      "name": "payeeMismatch",
      "msg": "Payee accounts passed for settlement do not match the stored payees"
    },
    {
      "code": 6014,
      "name": "duplicatePayee",
      "msg": "This address is already a payee on the show"
    },
    {
      "code": 6015,
      "name": "textLength",
      "msg": "A text field is empty or longer than allowed"
    },
    {
      "code": 6016,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6017,
      "name": "wrongTourId",
      "msg": "Tour id must equal the band's next sequential tour number"
    },
    {
      "code": 6018,
      "name": "invalidCapacity",
      "msg": "Capacity must be greater than zero"
    }
  ],
  "types": [
    {
      "name": "bandProfile",
      "docs": [
        "A band (or artist). Its counters are the on-chain track record that venue",
        "agents read as proof of past concerts; only `settle_show` can increase them."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "genre",
            "type": "string"
          },
          {
            "name": "toursCreated",
            "type": "u32"
          },
          {
            "name": "showsCompleted",
            "type": "u32"
          },
          {
            "name": "ticketsSoldTotal",
            "type": "u64"
          },
          {
            "name": "grossSettledLamports",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "bandRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bandProfile",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "payee",
      "docs": [
        "An extra party that receives a slice of the settlement (sound, lights, driver...)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "bps",
            "type": "u16"
          },
          {
            "name": "label",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "payeeAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "bps",
            "type": "u16"
          },
          {
            "name": "label",
            "type": "string"
          },
          {
            "name": "bandBpsAfter",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "show",
      "docs": [
        "One concert at one venue on one date, with its own escrow vault."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tour",
            "type": "pubkey"
          },
          {
            "name": "bandProfile",
            "type": "pubkey"
          },
          {
            "name": "venueProfile",
            "type": "pubkey"
          },
          {
            "name": "bandAuthority",
            "type": "pubkey"
          },
          {
            "name": "venueAuthority",
            "type": "pubkey"
          },
          {
            "name": "date",
            "docs": [
              "Unix timestamp of the show."
            ],
            "type": "i64"
          },
          {
            "name": "ticketPriceLamports",
            "type": "u64"
          },
          {
            "name": "capacity",
            "docs": [
              "Tickets offered for this show (at most the venue capacity)."
            ],
            "type": "u32"
          },
          {
            "name": "thresholdBps",
            "docs": [
              "Share of `capacity` that must be sold by `threshold_deadline`, in bps."
            ],
            "type": "u16"
          },
          {
            "name": "thresholdDeadline",
            "docs": [
              "Unix timestamp after which an unmet threshold cancels the show."
            ],
            "type": "i64"
          },
          {
            "name": "bandBps",
            "type": "u16"
          },
          {
            "name": "venueBps",
            "type": "u16"
          },
          {
            "name": "ticketsSold",
            "type": "u32"
          },
          {
            "name": "ticketsRefunded",
            "type": "u32"
          },
          {
            "name": "escrowLamports",
            "docs": [
              "Lamports held for ticket holders (excludes the vault's rent float)."
            ],
            "type": "u64"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "showState"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "payees",
            "type": {
              "vec": {
                "defined": {
                  "name": "payee"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "showAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "venueAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "showCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "ticketsSold",
            "type": "u32"
          },
          {
            "name": "ticketsRequired",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "showConfirmed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "ticketsSold",
            "type": "u32"
          },
          {
            "name": "capacity",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "showProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "tour",
            "type": "pubkey"
          },
          {
            "name": "venueProfile",
            "type": "pubkey"
          },
          {
            "name": "date",
            "type": "i64"
          },
          {
            "name": "ticketPriceLamports",
            "type": "u64"
          },
          {
            "name": "capacity",
            "type": "u32"
          },
          {
            "name": "thresholdBps",
            "type": "u16"
          },
          {
            "name": "thresholdDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "showRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "venueAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "showSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "totalLamports",
            "type": "u64"
          },
          {
            "name": "bandLamports",
            "type": "u64"
          },
          {
            "name": "venueLamports",
            "type": "u64"
          },
          {
            "name": "payeeLamports",
            "type": "u64"
          },
          {
            "name": "ticketsSold",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "showState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "proposed"
          },
          {
            "name": "onSale"
          },
          {
            "name": "confirmed"
          },
          {
            "name": "cancelled"
          },
          {
            "name": "settled"
          }
        ]
      }
    },
    {
      "name": "ticket",
      "docs": [
        "One purchase by one beneficiary for one show. Closed to the buyer on refund,",
        "kept forever after settlement as proof of attendance."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "docs": [
              "Beneficiary: receives the refund if the show is cancelled."
            ],
            "type": "pubkey"
          },
          {
            "name": "payer",
            "docs": [
              "Wallet that paid (may differ from `buyer`, e.g. a fan hub paying for fans)."
            ],
            "type": "pubkey"
          },
          {
            "name": "quantity",
            "type": "u16"
          },
          {
            "name": "amountLamports",
            "type": "u64"
          },
          {
            "name": "purchasedAt",
            "type": "i64"
          },
          {
            "name": "refunded",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ticketBought",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "ticket",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "quantity",
            "type": "u16"
          },
          {
            "name": "amountLamports",
            "type": "u64"
          },
          {
            "name": "ticketsSold",
            "type": "u32"
          },
          {
            "name": "thresholdMet",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "ticketRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "show",
            "type": "pubkey"
          },
          {
            "name": "ticket",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amountLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tour",
      "docs": [
        "A tour groups the shows a band's agent books for one date window and region."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bandProfile",
            "type": "pubkey"
          },
          {
            "name": "tourId",
            "type": "u32"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "startsAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          },
          {
            "name": "showsCount",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tourCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tour",
            "type": "pubkey"
          },
          {
            "name": "bandProfile",
            "type": "pubkey"
          },
          {
            "name": "tourId",
            "type": "u32"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "startsAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "venueProfile",
      "docs": [
        "A venue (club or hall) with its location and standing capacity."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "city",
            "type": "string"
          },
          {
            "name": "latE6",
            "docs": [
              "Latitude * 1e6"
            ],
            "type": "i32"
          },
          {
            "name": "lngE6",
            "docs": [
              "Longitude * 1e6"
            ],
            "type": "i32"
          },
          {
            "name": "capacity",
            "type": "u32"
          },
          {
            "name": "showsHosted",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "venueRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "venueProfile",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "city",
            "type": "string"
          },
          {
            "name": "capacity",
            "type": "u32"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "bandSeed",
      "type": "bytes",
      "value": "[98, 97, 110, 100]"
    },
    {
      "name": "bpsDenominator",
      "docs": [
        "Basis-point denominator used for thresholds and payout splits."
      ],
      "type": "u64",
      "value": "10000"
    },
    {
      "name": "maxPayees",
      "docs": [
        "Maximum extra payees (crew, services) a show can carry besides band and venue."
      ],
      "type": "u8",
      "value": "4"
    },
    {
      "name": "maxTicketsPerPurchase",
      "docs": [
        "Maximum tickets one purchase (one `Ticket` account) can hold."
      ],
      "type": "u16",
      "value": "10"
    },
    {
      "name": "showSeed",
      "type": "bytes",
      "value": "[115, 104, 111, 119]"
    },
    {
      "name": "ticketSeed",
      "type": "bytes",
      "value": "[116, 105, 99, 107, 101, 116]"
    },
    {
      "name": "tourSeed",
      "type": "bytes",
      "value": "[116, 111, 117, 114]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    },
    {
      "name": "venueSeed",
      "type": "bytes",
      "value": "[118, 101, 110, 117, 101]"
    }
  ]
};
