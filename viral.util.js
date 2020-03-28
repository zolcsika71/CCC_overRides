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

viralUtil.terminalOrderToSell = function (roomName) {

    if (_.isUndefined(roomName)) {
        let myRooms = _.filter(Game.rooms, {'my': true});
        for (let room of myRooms)
            room.terminalOrderToSell();
    } else
        Game.rooms[roomName].terminalOrderToSell();
};


viralUtil.terminalBroker = function (roomName = undefined) {


    if (_.isUndefined(roomName)) {
        let myRooms = _.filter(Game.rooms, {'my': true});
        for (let room of myRooms)
            room.terminalBroker();
    } else
        Game.rooms[roomName].terminalBroker();
};

viralUtil.fixTerminal = function (roomName) {

    let room = Game.rooms[roomName],
        data = room.memory.resources,
        terminalMemory = room.memory.resources.terminal[0],
        tOrders,
        terminal = room.terminal;

    console.log(`BEFORE: ${terminalMemory.orders.length}`);

    //global.BB(terminalMemory.orders);

    // TODO is it necessary?
    // garbage collecting offerRoom terminal orders
    if (terminalMemory.orders.length > 0) {
        tOrders = _.filter(terminalMemory.orders, order => {

            console.log(`1., ${order.type} ${_.some(data.offers, offer => {
                return (offer.type === order.type && offer.amount === order.orderRemaining + (terminal.store[offer.type] || 0));
            })}`);

            console.log(`2., ${order.type} ${order.type === room.mineralType && room.storage.store[order.type] >= global.MAX_STORAGE_MINERAL}`);

            console.log(`3., ${order.type} ${order.type.length === 1 && order.type !== room.mineralType && order.type !== RESOURCE_ENERGY && room.storage.store[order.type] >= global.MAX_STORAGE_NOT_ROOM_MINERAL}`);

            console.log(`4., ${order.type} ${global.SELL_COMPOUND[order.type] && global.SELL_COMPOUND[order.type].sell
            && (global.SELL_COMPOUND[order.type].rooms.length === 0 || _.some(global.SELL_COMPOUND[mineral], {'rooms': room.name}))}`);


            return (order.orderRemaining > 0 || order.storeAmount > 0)
                && (_.some(data.offers, offer => {
                        return (offer.type === order.type && offer.amount === order.orderRemaining + (terminal.store[offer.type] || 0));
                    })
                    || (order.type === room.mineralType && room.storage.store[order.type] >= global.MAX_STORAGE_MINERAL)
                    || (order.type.length === 1 && order.type !== room.mineralType && order.type !== RESOURCE_ENERGY && room.storage.store[order.type] >= global.MAX_STORAGE_NOT_ROOM_MINERAL)
                    || (global.SELL_COMPOUND[order.type] && global.SELL_COMPOUND[order.type].sell
                        && (global.SELL_COMPOUND[order.type].rooms.length === 0 || _.some(global.SELL_COMPOUND[mineral], {'rooms': room.name})))
                );
        });
    }



    console.log(`AFTER: ${tOrders.length}`);

    //global.BB(terminalMemory.orders);



};


viralUtil.findOrders = function (roomName) {

    let myRooms = _.filter(Game.rooms, {'my': true}),
        counter = 0;

    for (let room of myRooms) {

        if (roomName !== undefined && room.name !== roomName)
            continue;

        let data = room.memory.resources,
            terminalOrder = data.terminal[0].orders;

        if (terminalOrder.length > 0) {
            console.log(`${room.name} ${terminalOrder.length}`);
            //global.BB(terminalOrder.slice());
            counter++
        }
    }

    console.log(counter);
};

viralUtil.compoundMaking = function () {

    let myRooms = _.filter(Game.rooms, {'my': true}),
        counter = 0;

    for (let room of myRooms) {

        let data = room.memory.resources,
            reactions = data.reactions;

        if (reactions.orders.length > 0) {
            console.log(`${room.name} ${reactions.orders[0].type} ${reactions.orders[0].amount}`);
            //global.BB(terminalOrder.slice());
            counter++
        }
    }
    console.log(counter);
};

viralUtil.cancelTerminalOrder = function (roomName) {

    if (roomName === undefined) {
        let myRooms = _.filter(Game.rooms, {'my': true});

        for (let room of myRooms)
            room.cancelTerminalOrderToSell();
    } else
        Game.rooms[roomName].cancelTerminalOrderToSell();

};

viralUtil.deleteTerminalOrder = function (roomName) {

    if (roomName === undefined) {
        let myRooms = _.filter(Game.rooms, {'my': true});

        for (let room of myRooms)
            room.memory.resources.terminal[0].orders = [];
    } else
        Game.rooms[roomName].memory.resources.terminal[0].orders = [];

};

viralUtil.lastSales = function () {

    let outgoingTransactions = _.filter(Game.market.outgoingTransactions, transaction => {
        return transaction.resourceType.length === 5;
    });

    for (let transaction of outgoingTransactions) {
        //let transactionObject = outgoingTransactions[transaction];
        console.log(`room: ${transaction.from} resourceType: ${transaction.resourceType} amount: ${transaction.amount} price: ${transaction.order.price}`);
    }

};

viralUtil.cancelMarket = function (mineral) {

    let cancelAllInactiveOrder = function () {

        let inactiveOrders = _.filter(Game.market.orders, order => {
            return !order.active && order.type === 'sell';
        });

        for (let order of inactiveOrders) {

            let resourceType = order.resourceType,
                roomName = order.roomName,
                mineralExist = (this.storage.store[resourceType] || 0) + (this.terminal.store[resourceType] || 0) >= global.SELL_COMPOUND[resourceType].maxStorage + global.MIN_COMPOUND_SELL_AMOUNT;

            if (!mineralExist) {
                global.logSystem(roomName, `Inactive market order found in ${roomName} for ${resourceType}`);
                global.logSystem(roomName, `Order cancelled in ${roomName} for ${resourceType}`);
                Game.market.cancelOrder(order.id);
                numberOfOrders--
            }
        }
    };
};

viralUtil.look = function (x,y) {

    let pos = new RoomPosition(x, y, 'E25S21'),
        objects = pos.look(),
        noObstacle = !_.some(objects, object => {

            console.log(object.type);

            return object.type === 'creep' || (object.type === 'structure' && OBSTACLE_OBJECT_TYPES.includes(object.structureType)) || (object.type === 'terrain' && object.terrain === 'wall')

        });
    global.BB(objects);

    console.log(`noObstacle: ${_.findIndex(stuff, p => p.type === 'creep' || (p.type === 'structure' && OBSTACLE_OBJECT_TYPES.includes(p.structureType)) || (p.type === 'terrain' && p.terrain === 'wall')) === -1}`)


};

viralUtil.createLab = function (roomName) {

    let create = function (roomName) {

        if (_.isUndefined(Memory.rooms[roomName].resources))
            Memory.rooms[roomName].resources = {};

        Memory.rooms[roomName].resources.lab = [];
        for (let x in Memory.rooms[roomName].labs) {
            let lab = Memory.rooms[roomName].labs[x];
            let obj = {id: lab.id, orders: [], reactionState: 'idle'};
            Memory.rooms[roomName].resources.lab[x] = obj;
        }
    };



    if (roomName === undefined) {
        let myRooms = _.filter(Game.rooms, {'my': true});

        for (let room of myRooms)
            create(room.name);
    } else
        create(roomName);

};

viralUtil.clearRoomMemory = () => {
    Object.keys(Memory.rooms).forEach(room => {
        if ((_.isUndefined(Game.rooms[room]) || !Game.rooms[room].my) && room !== 'myTotalSites' && room !== 'myTotalStructures')
            delete Memory.rooms[room];
    })
};


module.exports = viralUtil;
