'use strict';
/**
 * getstats获取统计数据，根据开源api进行了改动
 * 开源地址： https://github.com/muaz-khan/getStats
 * 调用方法
 * 1. 初始化: var getStats = new GetStats(rtcConnection, interval)
 * 2. 开启监控: getStats.start()
 * 3. 关闭监控: getStats.stop()
 * 4. 回调监听: getStats.on('stats', onStats.bind(onStats))
 */

window.getStats = function(mediaStreamTrack, callback, interval) {

var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

if (typeof MediaStreamTrack === 'undefined') {
    MediaStreamTrack = {}; // todo?
}

var systemNetworkType = ((navigator.connection || {}).type || 'unknown').toString().toLowerCase();

var getStatsResult = {
    encryption: 'sha-256',
    audio: {
        send: {
            tracks: [],
            codecs: [],
            availableBandwidth: 0,
            streams: 0
        },
        recv: {
            tracks: [],
            codecs: [],
            availableBandwidth: 0,
            streams: 0
        },
        bytesSent: 0,
        bytesReceived: 0
    },
    video: {
        send: {
            tracks: [],
            codecs: [],
            availableBandwidth: 0,
            streams: 0
        },
        recv: {
            tracks: [],
            codecs: [],
            availableBandwidth: 0,
            streams: 0
        },
        bytesSent: 0,
        bytesReceived: 0
    },
    results: {},
    connectionType: {
        systemNetworkType: systemNetworkType,
        systemIpAddress: '192.168.1.2',
        local: {
            candidateType: [],
            transport: [],
            ipAddress: [],
            networkType: []
        },
        remote: {
            candidateType: [],
            transport: [],
            ipAddress: [],
            networkType: []
        }
    },
    resolutions: {
        send: {
            width: 0,
            height: 0
        },
        recv: {
            width: 0,
            height: 0
        }
    },
    internal: {
        audio: {
            send: {},
            recv: {}
        },
        video: {
            send: {},
            recv: {}
        },
        candidates: {}
    },
    nomore: function() {
        nomore = true;
    }
};

var getStatsParser = {
    checkIfOfferer: function(result) {
        if (result.type === 'googLibjingleSession') {
            getStatsResult.isOfferer = result.googInitiator;
        }
    }
};

var peer = this;

if (arguments[0] instanceof RTCPeerConnection) {
    peer = arguments[0];

    if (!!navigator.mozGetUserMedia) {
        mediaStreamTrack = arguments[1];
        callback = arguments[2];
        interval = arguments[3];
    }

    if (!(mediaStreamTrack instanceof MediaStreamTrack) && !!navigator.mozGetUserMedia) {
        throw '2nd argument is not instance of MediaStreamTrack.';
    }
} else if (!(mediaStreamTrack instanceof MediaStreamTrack) && !!navigator.mozGetUserMedia) {
    throw '1st argument is not instance of MediaStreamTrack.';
}

var nomore = false;

function getStatsLooper() {
    getStatsWrapper(function(results) {
        results.forEach(function(result) {
            Object.keys(getStatsParser).forEach(function(key) {
                if (typeof getStatsParser[key] === 'function') {
                    getStatsParser[key](result);
                }
            });
        });

        try {
            // failed|closed
            if (peer.iceConnectionState.search(/failed/gi) !== -1) {
                nomore = true;
            }
        } catch (e) {
            nomore = true;
        }

        if (nomore === true) {
            if (getStatsResult.datachannel) {
                getStatsResult.datachannel.state = 'close';
            }
            getStatsResult.ended = true;
        }

        // allow users to access native results
        getStatsResult.results = results;

        callback(getStatsResult);

        // second argument checks to see, if target-user is still connected.
        if (!nomore) {
            typeof interval != undefined && interval && setTimeout(getStatsLooper, interval || 1000);
        }
    });
}

// a wrapper around getStats which hides the differences (where possible)
// following code-snippet is taken from somewhere on the github
function getStatsWrapper(cb) {
    // if !peer or peer.signalingState == 'closed' then return;

    if (typeof window.InstallTrigger !== 'undefined') {
        peer.getStats(
            mediaStreamTrack,
            function(res) {
                var items = [];
                res.forEach(function(r) {
                    items.push(r);
                });
                cb(items);
            },
            cb
        );
    } else {
        peer.getStats(function(res) {
            var items = [];
            res.result().forEach(function(res) {
                var item = {};
                res.names().forEach(function(name) {
                    item[name] = res.stat(name);
                });
                item.id = res.id;
                item.type = res.type;
                item.timestamp = res.timestamp;
                items.push(item);
            });
            cb(items);
        });
    }
};

getStatsParser.datachannel = function(result) {
    if (result.type !== 'datachannel') return;

    getStatsResult.datachannel = {
        state: result.state // open or connecting
    }
};

getStatsParser.googCertificate = function(result) {
    if (result.type == 'googCertificate') {
        getStatsResult.encryption = result.googFingerprintAlgorithm;
    }
};

var AUDIO_codecs = ['opus', 'isac', 'ilbc'];

getStatsParser.checkAudioTracks = function(result) {
    if (!result.googCodecName || result.mediaType !== 'audio') return;

    if (AUDIO_codecs.indexOf(result.googCodecName.toLowerCase()) === -1) return;

    var sendrecvType = result.id.split('_').pop();

    if (getStatsResult.audio[sendrecvType].codecs.indexOf(result.googCodecName) === -1) {
        getStatsResult.audio[sendrecvType].codecs.push(result.googCodecName);
    }

    if (result.bytesSent) {
        var kilobytes = 0;
        if (!!result.bytesSent) {
            if (!getStatsResult.internal.audio[sendrecvType].prevBytesSent) {
                getStatsResult.internal.audio[sendrecvType].prevBytesSent = result.bytesSent;
            }

            var bytes = result.bytesSent - getStatsResult.internal.audio[sendrecvType].prevBytesSent;
            getStatsResult.internal.audio[sendrecvType].prevBytesSent = result.bytesSent;

            kilobytes = bytes / 1024;
        }

        getStatsResult.audio[sendrecvType].availableBandwidth = kilobytes.toFixed(1);
    }

    if (result.bytesReceived) {
        var kilobytes = 0;
        if (!!result.bytesReceived) {
            if (!getStatsResult.internal.audio[sendrecvType].prevBytesReceived) {
                getStatsResult.internal.audio[sendrecvType].prevBytesReceived = result.bytesReceived;
            }

            var bytes = result.bytesReceived - getStatsResult.internal.audio[sendrecvType].prevBytesReceived;
            getStatsResult.internal.audio[sendrecvType].prevBytesReceived = result.bytesReceived;

            kilobytes = bytes / 1024;
        }

        getStatsResult.audio[sendrecvType].availableBandwidth = kilobytes.toFixed(1);
    }

    if (getStatsResult.audio[sendrecvType].tracks.indexOf(result.googTrackId) === -1) {
        getStatsResult.audio[sendrecvType].tracks.push(result.googTrackId);
    }
};

var VIDEO_codecs = ['vp9', 'vp8', 'h264'];

getStatsParser.checkVideoTracks = function(result) {
    if (!result.googCodecName || result.mediaType !== 'video') return;

    if (VIDEO_codecs.indexOf(result.googCodecName.toLowerCase()) === -1) return;

    // googCurrentDelayMs, googRenderDelayMs, googTargetDelayMs
    // transportId === 'Channel-audio-1'
    var sendrecvType = result.id.split('_').pop();

    if (getStatsResult.video[sendrecvType].codecs.indexOf(result.googCodecName) === -1) {
        getStatsResult.video[sendrecvType].codecs.push(result.googCodecName);
    }

    if (!!result.bytesSent) {
        var kilobytes = 0;
        if (!getStatsResult.internal.video[sendrecvType].prevBytesSent) {
            getStatsResult.internal.video[sendrecvType].prevBytesSent = result.bytesSent;
        }

        var bytes = result.bytesSent - getStatsResult.internal.video[sendrecvType].prevBytesSent;
        getStatsResult.internal.video[sendrecvType].prevBytesSent = result.bytesSent;

        kilobytes = bytes / 1024;
    }

    if (!!result.bytesReceived) {
        var kilobytes = 0;
        if (!getStatsResult.internal.video[sendrecvType].prevBytesReceived) {
            getStatsResult.internal.video[sendrecvType].prevBytesReceived = result.bytesReceived;
        }

        var bytes = result.bytesReceived - getStatsResult.internal.video[sendrecvType].prevBytesReceived;
        getStatsResult.internal.video[sendrecvType].prevBytesReceived = result.bytesReceived;

        kilobytes = bytes / 1024;
    }

    getStatsResult.video[sendrecvType].availableBandwidth = kilobytes.toFixed(1);

    if (result.googFrameHeightReceived && result.googFrameWidthReceived) {
        getStatsResult.resolutions[sendrecvType].width = result.googFrameWidthReceived;
        getStatsResult.resolutions[sendrecvType].height = result.googFrameHeightReceived;
    }

    if (result.googFrameHeightSent && result.googFrameWidthSent) {
        getStatsResult.resolutions[sendrecvType].width = result.googFrameWidthSent;
        getStatsResult.resolutions[sendrecvType].height = result.googFrameHeightSent;
    }

    if (getStatsResult.video[sendrecvType].tracks.indexOf(result.googTrackId) === -1) {
        getStatsResult.video[sendrecvType].tracks.push(result.googTrackId);
    }
};

getStatsParser.bweforvideo = function(result) {
    if (result.type !== 'VideoBwe') return;

    // id === 'bweforvideo'

    getStatsResult.video.bandwidth = {
        googActualEncBitrate: result.googActualEncBitrate,
        googAvailableSendBandwidth: result.googAvailableSendBandwidth,
        googAvailableReceiveBandwidth: result.googAvailableReceiveBandwidth,
        googRetransmitBitrate: result.googRetransmitBitrate,
        googTargetEncBitrate: result.googTargetEncBitrate,
        googBucketDelay: result.googBucketDelay,
        googTransmitBitrate: result.googTransmitBitrate
    };
};

getStatsParser.googCandidatePair = function(result) {
    if (result.type !== 'googCandidatePair') return;

    // result.googActiveConnection means either STUN or TURN is used.

    if (result.googActiveConnection == 'true') {
        // id === 'Conn-audio-1-0'
        // localCandidateId, remoteCandidateId

        // bytesSent, bytesReceived

        getStatsResult.connectionType.local.ipAddress = result.googLocalAddress;
        getStatsResult.connectionType.remote.ipAddress = result.googRemoteAddress;
        getStatsResult.connectionType.transport = result.googTransportType;

        var localCandidate = getStatsResult.internal.candidates[result.localCandidateId];
        if (localCandidate) {
            if (localCandidate.ipAddress) {
                getStatsResult.connectionType.systemIpAddress = localCandidate.ipAddress;
            }
        }

        var remoteCandidate = getStatsResult.internal.candidates[result.remoteCandidateId];
        if (remoteCandidate) {
            if (remoteCandidate.ipAddress) {
                getStatsResult.connectionType.systemIpAddress = remoteCandidate.ipAddress;
            }
        }
    }
};

var LOCAL_candidateType = [];
var LOCAL_transport = [];
var LOCAL_ipAddress = [];
var LOCAL_networkType = [];

getStatsParser.localcandidate = function(result) {
    console.log(result)
    if (result.type !== 'localcandidate') return;

    if (result.candidateType && LOCAL_candidateType.indexOf(result.candidateType) === -1) {
        LOCAL_candidateType.push(result.candidateType);
    }

    if (result.transport && LOCAL_transport.indexOf(result.transport) === -1) {
        LOCAL_transport.push(result.transport);
    }

    if (result.ipAddress && LOCAL_ipAddress.indexOf(result.ipAddress + ':' + result.portNumber) === -1) {
        LOCAL_ipAddress.push(result.ipAddress + ':' + result.portNumber);
    }

    if (result.networkType && LOCAL_networkType.indexOf(result.networkType) === -1) {
        LOCAL_networkType.push(result.networkType);
    }

    getStatsResult.internal.candidates[result.id] = {
        candidateType: LOCAL_candidateType,
        ipAddress: LOCAL_ipAddress,
        portNumber: result.portNumber,
        networkType: LOCAL_networkType,
        priority: result.priority,
        transport: LOCAL_transport,
        timestamp: result.timestamp,
        id: result.id,
        type: result.type
    };

    getStatsResult.connectionType.local.candidateType = LOCAL_candidateType;
    getStatsResult.connectionType.local.ipAddress = LOCAL_ipAddress;
    getStatsResult.connectionType.local.networkType = LOCAL_networkType;
    getStatsResult.connectionType.local.transport = LOCAL_transport;
};

var REMOTE_candidateType = [];
var REMOTE_transport = [];
var REMOTE_ipAddress = [];
var REMOTE_networkType = [];

getStatsParser.remotecandidate = function(result) {
    if (result.type !== 'remotecandidate') return;

    if (result.candidateType && REMOTE_candidateType.indexOf(result.candidateType) === -1) {
        REMOTE_candidateType.push(result.candidateType);
    }

    if (result.transport && REMOTE_transport.indexOf(result.transport) === -1) {
        REMOTE_transport.push(result.transport);
    }

    if (result.ipAddress && REMOTE_ipAddress.indexOf(result.ipAddress + ':' + result.portNumber) === -1) {
        REMOTE_ipAddress.push(result.ipAddress + ':' + result.portNumber);
    }

    if (result.networkType && REMOTE_networkType.indexOf(result.networkType) === -1) {
        REMOTE_networkType.push(result.networkType);
    }

    getStatsResult.internal.candidates[result.id] = {
        candidateType: REMOTE_candidateType,
        ipAddress: REMOTE_ipAddress,
        portNumber: result.portNumber,
        networkType: REMOTE_networkType,
        priority: result.priority,
        transport: REMOTE_transport,
        timestamp: result.timestamp,
        id: result.id,
        type: result.type
    };

    getStatsResult.connectionType.remote.candidateType = REMOTE_candidateType;
    getStatsResult.connectionType.remote.ipAddress = REMOTE_ipAddress;
    getStatsResult.connectionType.remote.networkType = REMOTE_networkType;
    getStatsResult.connectionType.remote.transport = REMOTE_transport;
};

getStatsParser.dataSentReceived = function(result) {
    if (!result.googCodecName || (result.mediaType !== 'video' && result.mediaType !== 'audio')) return;

    if (!!result.bytesSent) {
        getStatsResult[result.mediaType].bytesSent = parseInt(result.bytesSent);
    }

    if (!!result.bytesReceived) {
        getStatsResult[result.mediaType].bytesReceived = parseInt(result.bytesReceived);
    }
};

var SSRC = {
    audio: {
        send: [],
        recv: []
    },
    video: {
        send: [],
        recv: []
    }
};

getStatsParser.ssrc = function(result) {
    if (!result.googCodecName || (result.mediaType !== 'video' && result.mediaType !== 'audio')) return;
    if (result.type !== 'ssrc') return;
    var sendrecvType = result.id.split('_').pop();

    if (SSRC[result.mediaType][sendrecvType].indexOf(result.ssrc) === -1) {
        SSRC[result.mediaType][sendrecvType].push(result.ssrc)
    }

    getStatsResult[result.mediaType][sendrecvType].streams = SSRC[result.mediaType][sendrecvType].length;
};

getStatsLooper();

};
