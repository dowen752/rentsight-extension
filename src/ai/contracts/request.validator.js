'use strict';
export const validate = validate20;
export default validate20;
const schema31 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:rentsight:extraction:1.0.0:request',
  title: 'RentSight extraction v1 request',
  type: 'object',
  properties: {
    schemaVersion: { type: 'string', enum: ['1.0.0'] },
    identity: { $ref: '#/$defs/identity' },
    capture: {
      type: 'object',
      properties: {
        capturedAt: { type: 'string', format: 'date-time', pattern: 'Z$' },
        truncated: { type: 'boolean' },
        unavailableSections: { type: 'array', items: { type: 'string' } },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', minLength: 1, maxLength: 200 },
              kind: {
                type: 'string',
                enum: [
                  'heading',
                  'paragraph',
                  'table',
                  'json_ld',
                  'footnote',
                  'other',
                ],
              },
              sectionPath: { type: 'array', items: { type: 'string' } },
              text: { type: 'string', maxLength: 200000 },
            },
            required: ['id', 'kind', 'sectionPath', 'text'],
            additionalProperties: false,
          },
          maxItems: 200,
        },
      },
      required: ['capturedAt', 'truncated', 'unavailableSections', 'blocks'],
      additionalProperties: false,
    },
    preliminaryValues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldPath: { type: 'string', pattern: '^/property/' },
          value: {},
        },
        required: ['fieldPath', 'value'],
        additionalProperties: false,
      },
      maxItems: 100,
    },
  },
  required: ['schemaVersion', 'identity', 'capture', 'preliminaryValues'],
  additionalProperties: false,
  $defs: {
    identity: {
      type: 'object',
      properties: {
        requestId: { type: 'string', format: 'uuid', maxLength: 200 },
        captureRevision: { type: 'string', minLength: 1, maxLength: 200 },
        listingUrl: { type: 'string', format: 'uri', pattern: '^https?://' },
        selectedUnit: {
          anyOf: [
            {
              type: 'object',
              properties: {
                id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                label: { type: 'string' },
              },
              required: ['id', 'label'],
              additionalProperties: false,
            },
            { type: 'null' },
          ],
        },
        selectedLeaseTermMonths: {
          anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'null' }],
        },
      },
      required: [
        'requestId',
        'captureRevision',
        'listingUrl',
        'selectedUnit',
        'selectedLeaseTermMonths',
      ],
      additionalProperties: false,
    },
  },
};
const schema32 = {
  type: 'object',
  properties: {
    requestId: { type: 'string', format: 'uuid', maxLength: 200 },
    captureRevision: { type: 'string', minLength: 1, maxLength: 200 },
    listingUrl: { type: 'string', format: 'uri', pattern: '^https?://' },
    selectedUnit: {
      anyOf: [
        {
          type: 'object',
          properties: {
            id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            label: { type: 'string' },
          },
          required: ['id', 'label'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    selectedLeaseTermMonths: {
      anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'null' }],
    },
  },
  required: [
    'requestId',
    'captureRevision',
    'listingUrl',
    'selectedUnit',
    'selectedLeaseTermMonths',
  ],
  additionalProperties: false,
};
const formats0 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const formats2 = /^https?:\/\/[^\s]+$/;
const formats4 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const pattern4 = new RegExp('^https?://', 'u');
const pattern5 = new RegExp('Z$', 'u');
const pattern6 = new RegExp('^/property/', 'u');
function validate20(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  /*# sourceURL="urn:rentsight:extraction:1.0.0:request" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.schemaVersion === undefined && (missing0 = 'schemaVersion')) ||
        (data.identity === undefined && (missing0 = 'identity')) ||
        (data.capture === undefined && (missing0 = 'capture')) ||
        (data.preliminaryValues === undefined &&
          (missing0 = 'preliminaryValues'))
      ) {
        validate20.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(
            key0 === 'schemaVersion' ||
            key0 === 'identity' ||
            key0 === 'capture' ||
            key0 === 'preliminaryValues'
          )) {
            validate20.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.schemaVersion !== undefined) {
            let data0 = data.schemaVersion;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate20.errors = [
                {
                  instancePath: instancePath + '/schemaVersion',
                  schemaPath: '#/properties/schemaVersion/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (!(data0 === '1.0.0')) {
              validate20.errors = [
                {
                  instancePath: instancePath + '/schemaVersion',
                  schemaPath: '#/properties/schemaVersion/enum',
                  keyword: 'enum',
                  params: {
                    allowedValues: schema31.properties.schemaVersion.enum,
                  },
                  message: 'must be equal to one of the allowed values',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.identity !== undefined) {
              let data1 = data.identity;
              const _errs4 = errors;
              const _errs5 = errors;
              if (errors === _errs5) {
                if (
                  data1 &&
                  typeof data1 == 'object' &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = 'requestId')) ||
                    (data1.captureRevision === undefined &&
                      (missing1 = 'captureRevision')) ||
                    (data1.listingUrl === undefined &&
                      (missing1 = 'listingUrl')) ||
                    (data1.selectedUnit === undefined &&
                      (missing1 = 'selectedUnit')) ||
                    (data1.selectedLeaseTermMonths === undefined &&
                      (missing1 = 'selectedLeaseTermMonths'))
                  ) {
                    validate20.errors = [
                      {
                        instancePath: instancePath + '/identity',
                        schemaPath: '#/$defs/identity/required',
                        keyword: 'required',
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs7 = errors;
                    for (const key1 in data1) {
                      if (!(
                        key1 === 'requestId' ||
                        key1 === 'captureRevision' ||
                        key1 === 'listingUrl' ||
                        key1 === 'selectedUnit' ||
                        key1 === 'selectedLeaseTermMonths'
                      )) {
                        validate20.errors = [
                          {
                            instancePath: instancePath + '/identity',
                            schemaPath: '#/$defs/identity/additionalProperties',
                            keyword: 'additionalProperties',
                            params: { additionalProperty: key1 },
                            message: 'must NOT have additional properties',
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs7 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs8 = errors;
                        if (errors === _errs8) {
                          if (errors === _errs8) {
                            if (typeof data2 === 'string') {
                              if (data2.length > 200) {
                                validate20.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/identity/requestId',
                                    schemaPath:
                                      '#/$defs/identity/properties/requestId/maxLength',
                                    keyword: 'maxLength',
                                    params: { limit: 200 },
                                    message:
                                      'must NOT have more than 200 characters',
                                  },
                                ];
                                return false;
                              } else {
                                if (!formats0.test(data2)) {
                                  validate20.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/identity/requestId',
                                      schemaPath:
                                        '#/$defs/identity/properties/requestId/format',
                                      keyword: 'format',
                                      params: { format: 'uuid' },
                                      message:
                                        'must match format "' + 'uuid' + '"',
                                    },
                                  ];
                                  return false;
                                }
                              }
                            } else {
                              validate20.errors = [
                                {
                                  instancePath:
                                    instancePath + '/identity/requestId',
                                  schemaPath:
                                    '#/$defs/identity/properties/requestId/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs8 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.captureRevision !== undefined) {
                          let data3 = data1.captureRevision;
                          const _errs10 = errors;
                          if (errors === _errs10) {
                            if (typeof data3 === 'string') {
                              if (data3.length > 200) {
                                validate20.errors = [
                                  {
                                    instancePath:
                                      instancePath +
                                      '/identity/captureRevision',
                                    schemaPath:
                                      '#/$defs/identity/properties/captureRevision/maxLength',
                                    keyword: 'maxLength',
                                    params: { limit: 200 },
                                    message:
                                      'must NOT have more than 200 characters',
                                  },
                                ];
                                return false;
                              } else {
                                if (data3.length < 1) {
                                  validate20.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        '/identity/captureRevision',
                                      schemaPath:
                                        '#/$defs/identity/properties/captureRevision/minLength',
                                      keyword: 'minLength',
                                      params: { limit: 1 },
                                      message:
                                        'must NOT have fewer than 1 characters',
                                    },
                                  ];
                                  return false;
                                }
                              }
                            } else {
                              validate20.errors = [
                                {
                                  instancePath:
                                    instancePath + '/identity/captureRevision',
                                  schemaPath:
                                    '#/$defs/identity/properties/captureRevision/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                },
                              ];
                              return false;
                            }
                          }
                          var valid2 = _errs10 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.listingUrl !== undefined) {
                            let data4 = data1.listingUrl;
                            const _errs12 = errors;
                            if (errors === _errs12) {
                              if (errors === _errs12) {
                                if (typeof data4 === 'string') {
                                  if (!pattern4.test(data4)) {
                                    validate20.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/identity/listingUrl',
                                        schemaPath:
                                          '#/$defs/identity/properties/listingUrl/pattern',
                                        keyword: 'pattern',
                                        params: { pattern: '^https?://' },
                                        message:
                                          'must match pattern "' +
                                          '^https?://' +
                                          '"',
                                      },
                                    ];
                                    return false;
                                  } else {
                                    if (!formats2.test(data4)) {
                                      validate20.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/identity/listingUrl',
                                          schemaPath:
                                            '#/$defs/identity/properties/listingUrl/format',
                                          keyword: 'format',
                                          params: { format: 'uri' },
                                          message:
                                            'must match format "' + 'uri' + '"',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                } else {
                                  validate20.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/identity/listingUrl',
                                      schemaPath:
                                        '#/$defs/identity/properties/listingUrl/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                              }
                            }
                            var valid2 = _errs12 === errors;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data1.selectedUnit !== undefined) {
                              let data5 = data1.selectedUnit;
                              const _errs14 = errors;
                              const _errs15 = errors;
                              let valid3 = false;
                              const _errs16 = errors;
                              if (errors === _errs16) {
                                if (
                                  data5 &&
                                  typeof data5 == 'object' &&
                                  !Array.isArray(data5)
                                ) {
                                  let missing2;
                                  if (
                                    (data5.id === undefined &&
                                      (missing2 = 'id')) ||
                                    (data5.label === undefined &&
                                      (missing2 = 'label'))
                                  ) {
                                    const err0 = {
                                      instancePath:
                                        instancePath + '/identity/selectedUnit',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedUnit/anyOf/0/required',
                                      keyword: 'required',
                                      params: { missingProperty: missing2 },
                                      message:
                                        "must have required property '" +
                                        missing2 +
                                        "'",
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err0];
                                    } else {
                                      vErrors.push(err0);
                                    }
                                    errors++;
                                  } else {
                                    const _errs18 = errors;
                                    for (const key2 in data5) {
                                      if (!(
                                        key2 === 'id' || key2 === 'label'
                                      )) {
                                        const err1 = {
                                          instancePath:
                                            instancePath +
                                            '/identity/selectedUnit',
                                          schemaPath:
                                            '#/$defs/identity/properties/selectedUnit/anyOf/0/additionalProperties',
                                          keyword: 'additionalProperties',
                                          params: { additionalProperty: key2 },
                                          message:
                                            'must NOT have additional properties',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err1];
                                        } else {
                                          vErrors.push(err1);
                                        }
                                        errors++;
                                        break;
                                      }
                                    }
                                    if (_errs18 === errors) {
                                      if (data5.id !== undefined) {
                                        let data6 = data5.id;
                                        const _errs19 = errors;
                                        const _errs20 = errors;
                                        let valid5 = false;
                                        const _errs21 = errors;
                                        if (typeof data6 !== 'string') {
                                          const err2 = {
                                            instancePath:
                                              instancePath +
                                              '/identity/selectedUnit/id',
                                            schemaPath:
                                              '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf/0/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err2];
                                          } else {
                                            vErrors.push(err2);
                                          }
                                          errors++;
                                        }
                                        var _valid1 = _errs21 === errors;
                                        valid5 = valid5 || _valid1;
                                        const _errs23 = errors;
                                        if (data6 !== null) {
                                          const err3 = {
                                            instancePath:
                                              instancePath +
                                              '/identity/selectedUnit/id',
                                            schemaPath:
                                              '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf/1/type',
                                            keyword: 'type',
                                            params: { type: 'null' },
                                            message: 'must be null',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err3];
                                          } else {
                                            vErrors.push(err3);
                                          }
                                          errors++;
                                        }
                                        var _valid1 = _errs23 === errors;
                                        valid5 = valid5 || _valid1;
                                        if (!valid5) {
                                          const err4 = {
                                            instancePath:
                                              instancePath +
                                              '/identity/selectedUnit/id',
                                            schemaPath:
                                              '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf',
                                            keyword: 'anyOf',
                                            params: {},
                                            message:
                                              'must match a schema in anyOf',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err4];
                                          } else {
                                            vErrors.push(err4);
                                          }
                                          errors++;
                                        } else {
                                          errors = _errs20;
                                          if (vErrors !== null) {
                                            if (_errs20) {
                                              vErrors.length = _errs20;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid4 = _errs19 === errors;
                                      } else {
                                        var valid4 = true;
                                      }
                                      if (valid4) {
                                        if (data5.label !== undefined) {
                                          const _errs25 = errors;
                                          if (typeof data5.label !== 'string') {
                                            const err5 = {
                                              instancePath:
                                                instancePath +
                                                '/identity/selectedUnit/label',
                                              schemaPath:
                                                '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/label/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err5];
                                            } else {
                                              vErrors.push(err5);
                                            }
                                            errors++;
                                          }
                                          var valid4 = _errs25 === errors;
                                        } else {
                                          var valid4 = true;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const err6 = {
                                    instancePath:
                                      instancePath + '/identity/selectedUnit',
                                    schemaPath:
                                      '#/$defs/identity/properties/selectedUnit/anyOf/0/type',
                                    keyword: 'type',
                                    params: { type: 'object' },
                                    message: 'must be object',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err6];
                                  } else {
                                    vErrors.push(err6);
                                  }
                                  errors++;
                                }
                              }
                              var _valid0 = _errs16 === errors;
                              valid3 = valid3 || _valid0;
                              const _errs27 = errors;
                              if (data5 !== null) {
                                const err7 = {
                                  instancePath:
                                    instancePath + '/identity/selectedUnit',
                                  schemaPath:
                                    '#/$defs/identity/properties/selectedUnit/anyOf/1/type',
                                  keyword: 'type',
                                  params: { type: 'null' },
                                  message: 'must be null',
                                };
                                if (vErrors === null) {
                                  vErrors = [err7];
                                } else {
                                  vErrors.push(err7);
                                }
                                errors++;
                              }
                              var _valid0 = _errs27 === errors;
                              valid3 = valid3 || _valid0;
                              if (!valid3) {
                                const err8 = {
                                  instancePath:
                                    instancePath + '/identity/selectedUnit',
                                  schemaPath:
                                    '#/$defs/identity/properties/selectedUnit/anyOf',
                                  keyword: 'anyOf',
                                  params: {},
                                  message: 'must match a schema in anyOf',
                                };
                                if (vErrors === null) {
                                  vErrors = [err8];
                                } else {
                                  vErrors.push(err8);
                                }
                                errors++;
                                validate20.errors = vErrors;
                                return false;
                              } else {
                                errors = _errs15;
                                if (vErrors !== null) {
                                  if (_errs15) {
                                    vErrors.length = _errs15;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid2 = _errs14 === errors;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data1.selectedLeaseTermMonths !== undefined) {
                                let data8 = data1.selectedLeaseTermMonths;
                                const _errs29 = errors;
                                const _errs30 = errors;
                                let valid6 = false;
                                const _errs31 = errors;
                                if (errors === _errs31) {
                                  if (typeof data8 == 'number') {
                                    if (data8 <= 0 || isNaN(data8)) {
                                      const err9 = {
                                        instancePath:
                                          instancePath +
                                          '/identity/selectedLeaseTermMonths',
                                        schemaPath:
                                          '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf/0/exclusiveMinimum',
                                        keyword: 'exclusiveMinimum',
                                        params: { comparison: '>', limit: 0 },
                                        message: 'must be > 0',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err9];
                                      } else {
                                        vErrors.push(err9);
                                      }
                                      errors++;
                                    }
                                  } else {
                                    const err10 = {
                                      instancePath:
                                        instancePath +
                                        '/identity/selectedLeaseTermMonths',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'number' },
                                      message: 'must be number',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err10];
                                    } else {
                                      vErrors.push(err10);
                                    }
                                    errors++;
                                  }
                                }
                                var _valid2 = _errs31 === errors;
                                valid6 = valid6 || _valid2;
                                const _errs33 = errors;
                                if (data8 !== null) {
                                  const err11 = {
                                    instancePath:
                                      instancePath +
                                      '/identity/selectedLeaseTermMonths',
                                    schemaPath:
                                      '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf/1/type',
                                    keyword: 'type',
                                    params: { type: 'null' },
                                    message: 'must be null',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err11];
                                  } else {
                                    vErrors.push(err11);
                                  }
                                  errors++;
                                }
                                var _valid2 = _errs33 === errors;
                                valid6 = valid6 || _valid2;
                                if (!valid6) {
                                  const err12 = {
                                    instancePath:
                                      instancePath +
                                      '/identity/selectedLeaseTermMonths',
                                    schemaPath:
                                      '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf',
                                    keyword: 'anyOf',
                                    params: {},
                                    message: 'must match a schema in anyOf',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err12];
                                  } else {
                                    vErrors.push(err12);
                                  }
                                  errors++;
                                  validate20.errors = vErrors;
                                  return false;
                                } else {
                                  errors = _errs30;
                                  if (vErrors !== null) {
                                    if (_errs30) {
                                      vErrors.length = _errs30;
                                    } else {
                                      vErrors = null;
                                    }
                                  }
                                }
                                var valid2 = _errs29 === errors;
                              } else {
                                var valid2 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate20.errors = [
                    {
                      instancePath: instancePath + '/identity',
                      schemaPath: '#/$defs/identity/type',
                      keyword: 'type',
                      params: { type: 'object' },
                      message: 'must be object',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.capture !== undefined) {
                let data9 = data.capture;
                const _errs35 = errors;
                if (errors === _errs35) {
                  if (
                    data9 &&
                    typeof data9 == 'object' &&
                    !Array.isArray(data9)
                  ) {
                    let missing3;
                    if (
                      (data9.capturedAt === undefined &&
                        (missing3 = 'capturedAt')) ||
                      (data9.truncated === undefined &&
                        (missing3 = 'truncated')) ||
                      (data9.unavailableSections === undefined &&
                        (missing3 = 'unavailableSections')) ||
                      (data9.blocks === undefined && (missing3 = 'blocks'))
                    ) {
                      validate20.errors = [
                        {
                          instancePath: instancePath + '/capture',
                          schemaPath: '#/properties/capture/required',
                          keyword: 'required',
                          params: { missingProperty: missing3 },
                          message:
                            "must have required property '" + missing3 + "'",
                        },
                      ];
                      return false;
                    } else {
                      const _errs37 = errors;
                      for (const key3 in data9) {
                        if (!(
                          key3 === 'capturedAt' ||
                          key3 === 'truncated' ||
                          key3 === 'unavailableSections' ||
                          key3 === 'blocks'
                        )) {
                          validate20.errors = [
                            {
                              instancePath: instancePath + '/capture',
                              schemaPath:
                                '#/properties/capture/additionalProperties',
                              keyword: 'additionalProperties',
                              params: { additionalProperty: key3 },
                              message: 'must NOT have additional properties',
                            },
                          ];
                          return false;
                          break;
                        }
                      }
                      if (_errs37 === errors) {
                        if (data9.capturedAt !== undefined) {
                          let data10 = data9.capturedAt;
                          const _errs38 = errors;
                          if (errors === _errs38) {
                            if (errors === _errs38) {
                              if (typeof data10 === 'string') {
                                if (!pattern5.test(data10)) {
                                  validate20.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/capture/capturedAt',
                                      schemaPath:
                                        '#/properties/capture/properties/capturedAt/pattern',
                                      keyword: 'pattern',
                                      params: { pattern: 'Z$' },
                                      message:
                                        'must match pattern "' + 'Z$' + '"',
                                    },
                                  ];
                                  return false;
                                } else {
                                  if (!formats4.test(data10)) {
                                    validate20.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/capture/capturedAt',
                                        schemaPath:
                                          '#/properties/capture/properties/capturedAt/format',
                                        keyword: 'format',
                                        params: { format: 'date-time' },
                                        message:
                                          'must match format "' +
                                          'date-time' +
                                          '"',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                              } else {
                                validate20.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/capture/capturedAt',
                                    schemaPath:
                                      '#/properties/capture/properties/capturedAt/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid7 = _errs38 === errors;
                        } else {
                          var valid7 = true;
                        }
                        if (valid7) {
                          if (data9.truncated !== undefined) {
                            const _errs40 = errors;
                            if (typeof data9.truncated !== 'boolean') {
                              validate20.errors = [
                                {
                                  instancePath:
                                    instancePath + '/capture/truncated',
                                  schemaPath:
                                    '#/properties/capture/properties/truncated/type',
                                  keyword: 'type',
                                  params: { type: 'boolean' },
                                  message: 'must be boolean',
                                },
                              ];
                              return false;
                            }
                            var valid7 = _errs40 === errors;
                          } else {
                            var valid7 = true;
                          }
                          if (valid7) {
                            if (data9.unavailableSections !== undefined) {
                              let data12 = data9.unavailableSections;
                              const _errs42 = errors;
                              if (errors === _errs42) {
                                if (Array.isArray(data12)) {
                                  var valid8 = true;
                                  const len0 = data12.length;
                                  for (let i0 = 0; i0 < len0; i0++) {
                                    const _errs44 = errors;
                                    if (typeof data12[i0] !== 'string') {
                                      validate20.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/capture/unavailableSections/' +
                                            i0,
                                          schemaPath:
                                            '#/properties/capture/properties/unavailableSections/items/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid8 = _errs44 === errors;
                                    if (!valid8) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate20.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        '/capture/unavailableSections',
                                      schemaPath:
                                        '#/properties/capture/properties/unavailableSections/type',
                                      keyword: 'type',
                                      params: { type: 'array' },
                                      message: 'must be array',
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid7 = _errs42 === errors;
                            } else {
                              var valid7 = true;
                            }
                            if (valid7) {
                              if (data9.blocks !== undefined) {
                                let data14 = data9.blocks;
                                const _errs46 = errors;
                                if (errors === _errs46) {
                                  if (Array.isArray(data14)) {
                                    if (data14.length > 200) {
                                      validate20.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/capture/blocks',
                                          schemaPath:
                                            '#/properties/capture/properties/blocks/maxItems',
                                          keyword: 'maxItems',
                                          params: { limit: 200 },
                                          message:
                                            'must NOT have more than 200 items',
                                        },
                                      ];
                                      return false;
                                    } else {
                                      var valid9 = true;
                                      const len1 = data14.length;
                                      for (let i1 = 0; i1 < len1; i1++) {
                                        let data15 = data14[i1];
                                        const _errs48 = errors;
                                        if (errors === _errs48) {
                                          if (
                                            data15 &&
                                            typeof data15 == 'object' &&
                                            !Array.isArray(data15)
                                          ) {
                                            let missing4;
                                            if (
                                              (data15.id === undefined &&
                                                (missing4 = 'id')) ||
                                              (data15.kind === undefined &&
                                                (missing4 = 'kind')) ||
                                              (data15.sectionPath ===
                                                undefined &&
                                                (missing4 = 'sectionPath')) ||
                                              (data15.text === undefined &&
                                                (missing4 = 'text'))
                                            ) {
                                              validate20.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/capture/blocks/' +
                                                    i1,
                                                  schemaPath:
                                                    '#/properties/capture/properties/blocks/items/required',
                                                  keyword: 'required',
                                                  params: {
                                                    missingProperty: missing4,
                                                  },
                                                  message:
                                                    "must have required property '" +
                                                    missing4 +
                                                    "'",
                                                },
                                              ];
                                              return false;
                                            } else {
                                              const _errs50 = errors;
                                              for (const key4 in data15) {
                                                if (!(
                                                  key4 === 'id' ||
                                                  key4 === 'kind' ||
                                                  key4 === 'sectionPath' ||
                                                  key4 === 'text'
                                                )) {
                                                  validate20.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/capture/blocks/' +
                                                        i1,
                                                      schemaPath:
                                                        '#/properties/capture/properties/blocks/items/additionalProperties',
                                                      keyword:
                                                        'additionalProperties',
                                                      params: {
                                                        additionalProperty:
                                                          key4,
                                                      },
                                                      message:
                                                        'must NOT have additional properties',
                                                    },
                                                  ];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs50 === errors) {
                                                if (data15.id !== undefined) {
                                                  let data16 = data15.id;
                                                  const _errs51 = errors;
                                                  if (errors === _errs51) {
                                                    if (
                                                      typeof data16 === 'string'
                                                    ) {
                                                      if (data16.length > 200) {
                                                        validate20.errors = [
                                                          {
                                                            instancePath:
                                                              instancePath +
                                                              '/capture/blocks/' +
                                                              i1 +
                                                              '/id',
                                                            schemaPath:
                                                              '#/properties/capture/properties/blocks/items/properties/id/maxLength',
                                                            keyword:
                                                              'maxLength',
                                                            params: {
                                                              limit: 200,
                                                            },
                                                            message:
                                                              'must NOT have more than 200 characters',
                                                          },
                                                        ];
                                                        return false;
                                                      } else {
                                                        if (data16.length < 1) {
                                                          validate20.errors = [
                                                            {
                                                              instancePath:
                                                                instancePath +
                                                                '/capture/blocks/' +
                                                                i1 +
                                                                '/id',
                                                              schemaPath:
                                                                '#/properties/capture/properties/blocks/items/properties/id/minLength',
                                                              keyword:
                                                                'minLength',
                                                              params: {
                                                                limit: 1,
                                                              },
                                                              message:
                                                                'must NOT have fewer than 1 characters',
                                                            },
                                                          ];
                                                          return false;
                                                        }
                                                      }
                                                    } else {
                                                      validate20.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/capture/blocks/' +
                                                            i1 +
                                                            '/id',
                                                          schemaPath:
                                                            '#/properties/capture/properties/blocks/items/properties/id/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'string',
                                                          },
                                                          message:
                                                            'must be string',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                  }
                                                  var valid10 =
                                                    _errs51 === errors;
                                                } else {
                                                  var valid10 = true;
                                                }
                                                if (valid10) {
                                                  if (
                                                    data15.kind !== undefined
                                                  ) {
                                                    let data17 = data15.kind;
                                                    const _errs53 = errors;
                                                    if (
                                                      typeof data17 !== 'string'
                                                    ) {
                                                      validate20.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/capture/blocks/' +
                                                            i1 +
                                                            '/kind',
                                                          schemaPath:
                                                            '#/properties/capture/properties/blocks/items/properties/kind/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'string',
                                                          },
                                                          message:
                                                            'must be string',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                    if (!(
                                                      data17 === 'heading' ||
                                                      data17 === 'paragraph' ||
                                                      data17 === 'table' ||
                                                      data17 === 'json_ld' ||
                                                      data17 === 'footnote' ||
                                                      data17 === 'other'
                                                    )) {
                                                      validate20.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/capture/blocks/' +
                                                            i1 +
                                                            '/kind',
                                                          schemaPath:
                                                            '#/properties/capture/properties/blocks/items/properties/kind/enum',
                                                          keyword: 'enum',
                                                          params: {
                                                            allowedValues:
                                                              schema31
                                                                .properties
                                                                .capture
                                                                .properties
                                                                .blocks.items
                                                                .properties.kind
                                                                .enum,
                                                          },
                                                          message:
                                                            'must be equal to one of the allowed values',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                    var valid10 =
                                                      _errs53 === errors;
                                                  } else {
                                                    var valid10 = true;
                                                  }
                                                  if (valid10) {
                                                    if (
                                                      data15.sectionPath !==
                                                      undefined
                                                    ) {
                                                      let data18 =
                                                        data15.sectionPath;
                                                      const _errs55 = errors;
                                                      if (errors === _errs55) {
                                                        if (
                                                          Array.isArray(data18)
                                                        ) {
                                                          var valid11 = true;
                                                          const len2 =
                                                            data18.length;
                                                          for (
                                                            let i2 = 0;
                                                            i2 < len2;
                                                            i2++
                                                          ) {
                                                            const _errs57 =
                                                              errors;
                                                            if (
                                                              typeof data18[
                                                                i2
                                                              ] !== 'string'
                                                            ) {
                                                              validate20.errors =
                                                                [
                                                                  {
                                                                    instancePath:
                                                                      instancePath +
                                                                      '/capture/blocks/' +
                                                                      i1 +
                                                                      '/sectionPath/' +
                                                                      i2,
                                                                    schemaPath:
                                                                      '#/properties/capture/properties/blocks/items/properties/sectionPath/items/type',
                                                                    keyword:
                                                                      'type',
                                                                    params: {
                                                                      type: 'string',
                                                                    },
                                                                    message:
                                                                      'must be string',
                                                                  },
                                                                ];
                                                              return false;
                                                            }
                                                            var valid11 =
                                                              _errs57 ===
                                                              errors;
                                                            if (!valid11) {
                                                              break;
                                                            }
                                                          }
                                                        } else {
                                                          validate20.errors = [
                                                            {
                                                              instancePath:
                                                                instancePath +
                                                                '/capture/blocks/' +
                                                                i1 +
                                                                '/sectionPath',
                                                              schemaPath:
                                                                '#/properties/capture/properties/blocks/items/properties/sectionPath/type',
                                                              keyword: 'type',
                                                              params: {
                                                                type: 'array',
                                                              },
                                                              message:
                                                                'must be array',
                                                            },
                                                          ];
                                                          return false;
                                                        }
                                                      }
                                                      var valid10 =
                                                        _errs55 === errors;
                                                    } else {
                                                      var valid10 = true;
                                                    }
                                                    if (valid10) {
                                                      if (
                                                        data15.text !==
                                                        undefined
                                                      ) {
                                                        let data20 =
                                                          data15.text;
                                                        const _errs59 = errors;
                                                        if (
                                                          errors === _errs59
                                                        ) {
                                                          if (
                                                            typeof data20 ===
                                                            'string'
                                                          ) {
                                                            if (
                                                              data20.length >
                                                              200000
                                                            ) {
                                                              validate20.errors =
                                                                [
                                                                  {
                                                                    instancePath:
                                                                      instancePath +
                                                                      '/capture/blocks/' +
                                                                      i1 +
                                                                      '/text',
                                                                    schemaPath:
                                                                      '#/properties/capture/properties/blocks/items/properties/text/maxLength',
                                                                    keyword:
                                                                      'maxLength',
                                                                    params: {
                                                                      limit: 200000,
                                                                    },
                                                                    message:
                                                                      'must NOT have more than 200000 characters',
                                                                  },
                                                                ];
                                                              return false;
                                                            }
                                                          } else {
                                                            validate20.errors =
                                                              [
                                                                {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/capture/blocks/' +
                                                                    i1 +
                                                                    '/text',
                                                                  schemaPath:
                                                                    '#/properties/capture/properties/blocks/items/properties/text/type',
                                                                  keyword:
                                                                    'type',
                                                                  params: {
                                                                    type: 'string',
                                                                  },
                                                                  message:
                                                                    'must be string',
                                                                },
                                                              ];
                                                            return false;
                                                          }
                                                        }
                                                        var valid10 =
                                                          _errs59 === errors;
                                                      } else {
                                                        var valid10 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate20.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/capture/blocks/' +
                                                  i1,
                                                schemaPath:
                                                  '#/properties/capture/properties/blocks/items/type',
                                                keyword: 'type',
                                                params: { type: 'object' },
                                                message: 'must be object',
                                              },
                                            ];
                                            return false;
                                          }
                                        }
                                        var valid9 = _errs48 === errors;
                                        if (!valid9) {
                                          break;
                                        }
                                      }
                                    }
                                  } else {
                                    validate20.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/capture/blocks',
                                        schemaPath:
                                          '#/properties/capture/properties/blocks/type',
                                        keyword: 'type',
                                        params: { type: 'array' },
                                        message: 'must be array',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid7 = _errs46 === errors;
                              } else {
                                var valid7 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate20.errors = [
                      {
                        instancePath: instancePath + '/capture',
                        schemaPath: '#/properties/capture/type',
                        keyword: 'type',
                        params: { type: 'object' },
                        message: 'must be object',
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs35 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.preliminaryValues !== undefined) {
                  let data21 = data.preliminaryValues;
                  const _errs61 = errors;
                  if (errors === _errs61) {
                    if (Array.isArray(data21)) {
                      if (data21.length > 100) {
                        validate20.errors = [
                          {
                            instancePath: instancePath + '/preliminaryValues',
                            schemaPath:
                              '#/properties/preliminaryValues/maxItems',
                            keyword: 'maxItems',
                            params: { limit: 100 },
                            message: 'must NOT have more than 100 items',
                          },
                        ];
                        return false;
                      } else {
                        var valid12 = true;
                        const len3 = data21.length;
                        for (let i3 = 0; i3 < len3; i3++) {
                          let data22 = data21[i3];
                          const _errs63 = errors;
                          if (errors === _errs63) {
                            if (
                              data22 &&
                              typeof data22 == 'object' &&
                              !Array.isArray(data22)
                            ) {
                              let missing5;
                              if (
                                (data22.fieldPath === undefined &&
                                  (missing5 = 'fieldPath')) ||
                                (data22.value === undefined &&
                                  (missing5 = 'value'))
                              ) {
                                validate20.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/preliminaryValues/' + i3,
                                    schemaPath:
                                      '#/properties/preliminaryValues/items/required',
                                    keyword: 'required',
                                    params: { missingProperty: missing5 },
                                    message:
                                      "must have required property '" +
                                      missing5 +
                                      "'",
                                  },
                                ];
                                return false;
                              } else {
                                const _errs65 = errors;
                                for (const key5 in data22) {
                                  if (!(
                                    key5 === 'fieldPath' || key5 === 'value'
                                  )) {
                                    validate20.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/preliminaryValues/' +
                                          i3,
                                        schemaPath:
                                          '#/properties/preliminaryValues/items/additionalProperties',
                                        keyword: 'additionalProperties',
                                        params: { additionalProperty: key5 },
                                        message:
                                          'must NOT have additional properties',
                                      },
                                    ];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs65 === errors) {
                                  if (data22.fieldPath !== undefined) {
                                    let data23 = data22.fieldPath;
                                    const _errs66 = errors;
                                    if (errors === _errs66) {
                                      if (typeof data23 === 'string') {
                                        if (!pattern6.test(data23)) {
                                          validate20.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/preliminaryValues/' +
                                                i3 +
                                                '/fieldPath',
                                              schemaPath:
                                                '#/properties/preliminaryValues/items/properties/fieldPath/pattern',
                                              keyword: 'pattern',
                                              params: {
                                                pattern: '^/property/',
                                              },
                                              message:
                                                'must match pattern "' +
                                                '^/property/' +
                                                '"',
                                            },
                                          ];
                                          return false;
                                        }
                                      } else {
                                        validate20.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/preliminaryValues/' +
                                              i3 +
                                              '/fieldPath',
                                            schemaPath:
                                              '#/properties/preliminaryValues/items/properties/fieldPath/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate20.errors = [
                                {
                                  instancePath:
                                    instancePath + '/preliminaryValues/' + i3,
                                  schemaPath:
                                    '#/properties/preliminaryValues/items/type',
                                  keyword: 'type',
                                  params: { type: 'object' },
                                  message: 'must be object',
                                },
                              ];
                              return false;
                            }
                          }
                          var valid12 = _errs63 === errors;
                          if (!valid12) {
                            break;
                          }
                        }
                      }
                    } else {
                      validate20.errors = [
                        {
                          instancePath: instancePath + '/preliminaryValues',
                          schemaPath: '#/properties/preliminaryValues/type',
                          keyword: 'type',
                          params: { type: 'array' },
                          message: 'must be array',
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs61 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate20.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
