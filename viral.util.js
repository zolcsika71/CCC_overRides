"use strict";

let viralUtil = {};

viralUtil.deleteRoads = function (flush = false) {

    if (flush)
        _.forEach(Memory.rooms, r => delete r.roadConstructionTrace);

    let room = 'E27S23',
        structures = Game.rooms[room].find(FIND_STRUCTURES),
        roads = _.filter(structures, function (structure) {
            return structure.structureType === STRUCTURE_ROAD
        });
    roads.forEach(road => {
        road.destroy();
    });

};

viralUtil.deleteStructures = function (roomName, type) {

    if (roomName === undefined) {
        console.log('usage: Util.deleteStructure(RoomName, structureType)');
        return;
    }

    let structures = Game.rooms[roomName].find(FIND_STRUCTURES);

    if (type) {
        structures = _.filter(structures, structure => {
            return structure.structureType === type;
        });
    }
    structures.forEach(structure => {
        structure.destroy();
    });
    console.log(`structures in room ${Game.rooms[roomName]} destroyed`);

};

// delete all constructionSites
viralUtil.deleteCS = function (roomName) {
    let constructionSites = Game.rooms[roomName].myConstructionSites;
    constructionSites.forEach(site => {
        site.remove();
    })
};

// running data to debug a creep use
viralUtil.data = function (creepName) {
    //console.log('Explain');
    //Game.creeps[creepName].explain();
    console.log('JSON');
    console.log(JSON.stringify(Game.creeps[creepName].data));
};

viralUtil.resetBoostProduction = function (roomName) {

    let data,
        myRooms = _.filter(Game.rooms, {'my': true});

    for (let room of myRooms) {

        if ((roomName === undefined || room.name === roomName)) {

            data = room.memory.resources;

            console.log(room.name);

            if (!_.isUndefined(data)) {

                data.offers = [];
                data.orders = [];

                if (data.terminal[0])
                    data.terminal[0].orders = [];

                if (data.storage[0])
                    data.storage[0].orders = [];

                if (data.reactions)
                    data.reactions.orders = [];

                if (data.lab) {
                    data.lab = [];
                    _.values(Game.structures).filter(i => i.structureType === 'lab').map(i => i.room.setStore(i.id, RESOURCE_ENERGY, 2000));
                }
                delete data.boostTiming;
                delete data.seedCheck;
            } else
                console.log(`${room.name} has no memory.resources`);
        }
    }
    if (roomName === undefined)
        delete Memory.boostTiming;

};

viralUtil.cleanTrace = function () {

    let myRooms = _.filter(Game.rooms, {'my': true});
    for (let room of myRooms)
        delete room.memory.roadConstructionTrace;

};

viralUtil.terminalBroker = function (roomName = undefined) {


    if (_.isUndefined(roomName)) {
        let myRooms = _.filter(Game.rooms, {'my': true});
        for (let room of myRooms)
            room.terminalBroker();
    } else
        Game.rooms[roomName].terminalBroker();
};

viralUtil.roomStored = function (mineral) {

    let myRooms =  _.filter(Game.rooms, room => {
            return room.my && room.storage && room.terminal;
        }),
        roomStored = 0;

    for (let room of myRooms) {
        roomStored += (room.resourcesStorage[mineral] || 0) + (room.resourcesTerminal[mineral] || 0);
    }
    return roomStored;
};

viralUtil.resourcesAll = function (mineral) {

    let myRooms =  _.filter(Game.rooms, room => {
            return room.my && room.storage && room.terminal;
        }),
        roomStored = 0;

    for (let room of myRooms) {
        let resources = room.resourcesAll[mineral] || 0;
        if (resources >= global.MIN_OFFER_AMOUNT)
            roomStored += resources;
    }
    return roomStored;
};

viralUtil.launchNuke = function (roomA, roomB, x, y) {

    console.log(`hello`);

    let roomFrom = Game.rooms[roomA],
        nuke = Game.getObjectById(roomFrom.memory.nukers[0].id),
        target = new RoomPosition(x, y, roomB),
        returnValue;

    if (!nuke.isActive())
        return false;

    if (nuke.energy < nuke.energyCapacity) {
        console.log(`not enough energy to launch nuke! energy: ${nuke.energy} energyCapacity: ${nuke.energyCapacity}`);
        return false;
    }

    if (nuke.ghodium < nuke.ghodiumCapacity) {
        console.log(`not enough G to launch nuke! ghodium: ${nuke.ghodium} ghodiumCapacity: ${nuke.ghodiumCapacity}`);
        return false;
    }

    returnValue = nuke.launchNuke(target);

    if (returnValue === OK)
        console.log('Nuke LAUNCHED!!!');
    else
        console.log(`Nuke launch failed: ${translateErrorCode(returnValue)}`);


};

viralUtil.checkTier3 = function (compound) {

    let myRooms = _.filter(Game.rooms, room => {
        return room.my && room.storage && room.terminal;
    });
    for (let room of myRooms) {
        if (room.resourcesAll[compound] < global.COMPOUNDS_TO_MAKE[compound].roomThreshold || 0)
            console.log(`${room.name}: ${compound} ${room.resourcesAll[compound] || 0}`);
    }
};

viralUtil.storageFull = function () {

    let myRooms = _.filter(Game.rooms, room => {
        return room.my && room.storage && room.terminal;
    });

    for (let room of myRooms) {

        let sumStorage = _.sum(room.storage.store);

        if (sumStorage >= STORAGE_CAPACITY * 0.9)
            console.log(`${room.name} ${sumStorage / STORAGE_CAPACITY}`);

    }

};

viralUtil.terminalFull = function () {

    let myRooms = _.filter(Game.rooms, room => {
        return room.my && room.storage && room.terminal;
    });

    for (let room of myRooms) {

        let sumTerminal = _.sum(room.terminal.store);

        if (sumTerminal >= STORAGE_CAPACITY * 0.9)
            console.log(`${room.name} ${sumTerminal / STORAGE_CAPACITY}`);

    }

};

viralUtil.mineralFull = function () {

    let myRooms = _.filter(Game.rooms, room => {
        return room.my && room.storage && room.terminal;
    });

    for (let room of myRooms) {

        let mineralType = room.memory.mineralType,
            storageStore = room.storage.store[mineralType],
            terminalStore = room.terminal.store[mineralType];

        if (storageStore && terminalStore)
            console.log(room.name, mineralType);
    }
};

viralUtil.remoteMiningRooms = function () {

    let myRooms = _.filter(Game.rooms, room => {
        return room.my && room.storage && room.terminal;
    });

    for (let room of myRooms)
        room.terminalOrderToSell();



};


viralUtil.allocatedRooms = function () {

    let myRooms = _.filter(Game.rooms, room => {
        return room.my && room.storage && room.terminal;
    });

    for (let room of myRooms) {

        let data = room.memory.resources,
            allocatedCompound,
            storageLabs;

        if (!data)
            continue;

        storageLabs = _.filter(data.lab, labs => {
            return labs.reactionState === 'Storage';
        });

        //console.log(`${room.name} ${storageLabs.length}`);

        if (storageLabs.length > 0) {
            allocatedCompound = _.filter(storageLabs.orders, order => {
                return order.type !== 'energy';
            });
        }
        if (allocatedCompound && allocatedCompound.length > 0) {
            global.logSystem(room.name, `${room.name}, ${global.BB(allocatedCompound)}`);
        }
    }
};

viralUtil.unAllocateCompound = function (type) {

    let typeExist = function () {

            let returnArray = [];

            //global.BB(Memory.allocateProperties.lastAllocated);

            Object.keys(Memory.allocateProperties.lastAllocated).forEach(guid => {

                let guidObject = Memory.allocateProperties.lastAllocated[guid];

                if (guidObject.type === type)
                    returnArray.push(guid);
            });
            return returnArray;
        },
        unAllocate = function (guid) {

            let unAllocateObject = Memory.allocateProperties.lastAllocated[guid];

            for (let compound of unAllocateObject.compounds) {
                let allocateRooms = Memory.compoundsToAllocate[compound].allocateRooms;
                for (let room of allocateRooms)
                    allocateRooms.splice(allocateRooms.indexOf(room), 1);

                if (allocateRooms.length === 0)
                    Memory.compoundsToAllocate[compound].allocate = false;

                Memory.compoundsToAllocate[compound].allocateRooms = allocateRooms;
                delete Memory.allocateProperties.lastAllocated[guid];
            }
        },
        guidArray = typeExist();

    if (guidArray.length === 0) {
        console.log(`no GUID for: ${type}`);
        return;
    }


    console.log(`unallocate: ${type}`);

    switch (type) {
        case 'defense':

            for (let guid of guidArray) {

                let invadedRooms = _.filter(guid.allocateRooms, room => {
                    return Game.rooms[room].hostiles.length > 0;
                });

                if (invadedRooms.length === 0)
                    unAllocate(guid);

            }



            // stuff
            break;
        case 'miner':
            // stuff
            break;
    }

};

viralUtil.terminalOrderToSell = function (roomName) {

    if (_.isUndefined(roomName)) {
        let myRooms = _.filter(Game.rooms, {'my': true});
        for (let room of myRooms)
            room.terminalOrderToSell();
    } else
        Game.rooms[roomName].terminalOrderToSell();
};



module.exports = viralUtil;
