'use strict';

let viralUtil = {};

viralUtil.deleteRoads = function (flush = false) {

	if (flush)
		_.forEach(Memory.rooms, r => delete r.roadConstructionTrace);

	let room = 'E27S23',
		structures = Game.rooms[room].find(FIND_STRUCTURES),
		roads = _.filter(structures, function (structure) {
			return structure.structureType === STRUCTURE_ROAD;
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
viralUtil.deleteConstructionSites = function (roomName) {
	if (_.isUndefined(roomName)) {
		console.log(`delete all constructionSites`);
		for (const room of myRooms) {
			let constructionSites = room.myConstructionSites;
			console.log(`room: ${room.name} sites: ${constructionSites}`);
			constructionSites.forEach(site => {
				console.log(`room: ${room.name} type: ${site.structureType}`);
				site.remove();
			});
		}
	} else {
		let constructionSites = Game.rooms[roomName].myConstructionSites;
		constructionSites.forEach(site => {
			site.remove();
		});
	}
};

viralUtil.DCS = function () {
	for (const cs in Game.constructionSites) {
		Game.constructionSites[cs].remove();
	}
};

// running data to debug a creep use
viralUtil.data = function (creepName) {
	//console.log('Explain');
	//Game.creeps[creepName].explain();
	console.log('JSON');
	console.log(JSON.stringify(Game.creeps[creepName].data));
};

viralUtil.resetBoostProduction = function (roomName) {

	let data;

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
	for (let room of myRooms)
		delete room.memory.roadConstructionTrace;

};
viralUtil.roomStored = function (mineral) {

	let roomStored = 0;

	for (let room of acceptedRooms) {
		roomStored += (room.storage.store[mineral] || 0) + (room.terminal.store[mineral] || 0);
	}
	return roomStored;
};

viralUtil.resourcesAll = function (mineral) {


	let roomStored = 0;

	for (let room of acceptedRooms) {
		let resources = room.resourcesAll[mineral] || 0;
		if (resources >= global.MIN_OFFER_AMOUNT)
			roomStored += resources;
	}
	return roomStored;
};

viralUtil.launchNuke = function (roomA, roomB, x, y) {

	console.log(`hello`);

	let roomFrom = Game.rooms[roomA],
		roomTo = Game.rooms[roomB],
		nuke = Game.getObjectById(roomFrom.memory.nukers[0].id),
		target = new RoomPosition(x, y, roomB),
		returnValue;

	if (_.isUndefined(roomTo)) {
		console.log(`targetRoom: ${roomB} not visible`);
	}


	if (!nuke.isActive())
		return false;

	if (nuke.store['energy'] < nuke.store.getCapacity('energy')) {
		console.log(`not enough energy to launch nuke! energy: ${nuke.energy} energyCapacity: ${nuke.energyCapacity}`);
		return false;
	}

	if (nuke.store['G'] < nuke.store.getCapacity('G')) {
		console.log(`not enough G to launch nuke! ghodium: ${nuke.store['G']} ghodiumCapacity: ${nuke.store.getCapacity('G')}`);
		return false;
	}

	if (Game.map.getRoomLinearDistance(roomFrom.name, roomTo.name) > 10) {
		console.log(`${roomB} is too far to launch nuke`);
		return false;
	}

	returnValue = nuke.launchNuke(target);

	if (returnValue === OK)
		console.log('Nuke LAUNCHED!!!');
	else
		console.log(`Nuke launch failed: ${this.translateErrorCode(returnValue)}`);

};

viralUtil.checkTier3 = function (compound) {
	for (let room of acceptedRooms) {
		if (room.resourcesAll[compound] < global.COMPOUNDS_TO_MAKE[compound].roomThreshold || 0)
			console.log(`${room.name}: ${compound} ${room.resourcesAll[compound] || 0}`);
	}
};

viralUtil.storageFull = function () {

	for (let room of acceptedRooms) {

		let sumStorage = _.sum(room.storage.store);

		if (sumStorage >= STORAGE_CAPACITY * 0.9) {
			console.log(`${room.name} ${sumStorage / STORAGE_CAPACITY}`);
			room.terminalBroker();
		}

	}

};

// if terminalBroker find a room for transfer
viralUtil.roomEnergy = () => {


	let requiresEnergy = _.filter(Game.rooms, room => {
		return room.my && room.storage && room.terminal &&
			room.terminal.store.getCapacity() < (room.terminal.sum + ENERGY_BALANCE_TRANSFER_AMOUNT) * TARGET_STORAGE_SUM_RATIO &&
			room.storage.store.getCapacity() < (room.storage.sum + ENERGY_BALANCE_TRANSFER_AMOUNT) * TARGET_STORAGE_SUM_RATIO &&
			!room._isReceivingEnergy &&
			room.storage.store[RESOURCE_ENERGY] < MAX_STORAGE_ENERGY[room.controller.level];
	});
	console.log(`requireEnergy ${requiresEnergy}`);


};

viralUtil.terminalFull = function () {

	for (let room of acceptedRooms) {

		let sumTerminal = _.sum(room.terminal.store);

		if (sumTerminal >= room.terminal.store.getCapacity() * 0.9) {
			console.log(`${room.name} ${sumTerminal / room.terminal.store.getCapacity()}`);
		}


	}

	console.log(`there is no full terminal`);

};

viralUtil.mineralFull = function () {

	for (let room of acceptedRooms) {

		let mineralType = room.memory.mineralType,
			storageStore = room.storage.store[mineralType],
			terminalStore = room.terminal.store[mineralType];

		if (storageStore && terminalStore)
			console.log(room.name, mineralType);
	}
};
viralUtil.allocatedRooms = function () {

	for (let room of acceptedRooms) {

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
		for (let room of myRooms)
			room.terminalOrderToSell();
	} else
		Game.rooms[roomName].terminalOrderToSell();
};


viralUtil.terminalBroker = function (roomName = undefined) {


	if (_.isUndefined(roomName)) {
		for (let room of myRooms) {
			console.log(`util at ${room.name}`);
			room.terminalBroker();
		}
	} else
		Game.rooms[roomName].terminalBroker();
};

viralUtil.terminalEnergy = () => {

	for (let room of myRooms) {
		if (room.terminal.store[RESOURCE_ENERGY] < 10000)
			console.log(room.name);
	}


};

viralUtil.fixTerminal = function (roomName = undefined) {

	let cleanTerminal = (room) => {
		let data = room.memory.resources,
			terminalMemory = room.memory.resources.terminal[0],
			tOrders,
			terminal = room.terminal;

		console.log(`BEFORE: ${room.name} ${terminalMemory.orders.length}`);

		//global.BB(terminalMemory.orders);

		// TODO is it necessary?
		// garbage collecting offerRoom terminal orders
		if (terminalMemory.orders.length > 0) {
			tOrders = _.filter(terminalMemory.orders, order => {

				console.log(`1., ${room.name} ${order.type} ${_.some(data.offers, offer => {
					return (offer.type === order.type && offer.amount === order.orderRemaining + (terminal.store[offer.type] || 0));
				})}`);

				console.log(`2., ${room.name} ${order.type} ${order.type === room.mineralType && room.storage.store[order.type] >= global.MAX_STORAGE_MINERAL}`);

				console.log(`3., ${room.name} ${order.type} ${order.type.length === 1 && order.type !== room.mineralType && order.type !== RESOURCE_ENERGY && room.storage.store[order.type] >= global.MAX_STORAGE_NOT_ROOM_MINERAL}`);

				console.log(`4., ${room.name} ${order.type} ${global.SELL_COMPOUND[order.type] && global.SELL_COMPOUND[order.type].sell
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

		if (tOrders)
			console.log(`AFTER: ${room.name} ${tOrders.length}`);

		//global.BB(terminalMemory.orders);
	};

	for (let room of myRooms) {
		if (roomName === undefined || room.name === roomName)
			cleanTerminal(room);
	}
};


viralUtil.findOrders = function (roomName) {

	let counter = 0;

	for (let room of myRooms) {

		if (roomName !== undefined && room.name !== roomName)
			continue;

		let data = room.memory.resources,
			terminalOrder = data.terminal[0].orders;

		if (terminalOrder.length > 0) {
			console.log(`${room.name} ${terminalOrder.length}`);
			//global.BB(terminalOrder.slice());
			counter++;
		}
	}

	console.log(counter);
};

viralUtil.compoundMaking = function () {

	let counter = 0;

	for (let room of myRooms) {

		let data = room.memory.resources,
			reactions = data.reactions;

		if (reactions.orders.length > 0) {
			console.log(`${room.name} ${reactions.orders[0].type} ${reactions.orders[0].amount}`);
			//global.BB(terminalOrder.slice());
			counter++;
		}
	}
	console.log(counter);
};

viralUtil.cancelTerminalOrder = function (roomName) {

	if (roomName === undefined) {
		for (let room of myRooms)
			room.cancelTerminalOrderToSell();
	} else
		Game.rooms[roomName].cancelTerminalOrderToSell();

};

viralUtil.deleteTerminalOrder = function (roomName) {

	if (roomName === undefined) {

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
				numberOfOrders--;
			}
		}
	};
};

viralUtil.look = function (x, y) {

	let pos = new RoomPosition(x, y, 'E25S21'),
		objects = pos.look(),
		noObstacle = !_.some(objects, object => {

			console.log(object.type);

			return object.type === 'creep' || (object.type === 'structure' && OBSTACLE_OBJECT_TYPES.includes(object.structureType)) || (object.type === 'terrain' && object.terrain === 'wall');

		});
	global.BB(objects);

	console.log(`noObstacle: ${_.findIndex(stuff, p => p.type === 'creep' || (p.type === 'structure' && OBSTACLE_OBJECT_TYPES.includes(p.structureType)) || (p.type === 'terrain' && p.terrain === 'wall')) === -1}`);


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

		for (let room of myRooms)
			create(room.name);
	} else
		create(roomName);

};

viralUtil.clearRoomMemory = () => {
	//Memory.pause = true;
	console.log(`${Object.keys(Memory.rooms).length}`);
	Object.keys(Memory.rooms).forEach(room => {
		if ((_.isUndefined(Game.rooms[room]) || !Game.rooms[room].my) && room !== 'myTotalSites' && room !== 'myTotalStructures') {
			delete Memory.rooms[room];
			console.log(`${room}`);
		}
	});
	console.log(`${Object.keys(Memory.rooms).length}`);
	delete Memory.routeRange;
	//Memory.pause = false;
};

viralUtil.createResources = () => {

	let rooms = _.filter(Game.rooms, (room) => {
		return room.my && room.storage && room.terminal;
	});

	for (let j = 0; j < rooms.length; j++) {
		let room = rooms[j];
		if (room.memory.resources === undefined) {
			room.memory.resources = {
				lab: [],
				powerSpawn: [],
				nuker: [],
				container: [],
				terminal: [],
				storage: [],
				offers: [],
				orders: [],
				reactions: {},
			};
			room.memory.resources.reactions.orders = [];
		}
	}

};


// if second terminal built it deletes, the old id from memory
viralUtil.terminalRepair = () => {

	let data;

	for (let room of myRooms) {
		if (Memory.rooms[room.name].resources.terminal.length > 1) {
			console.log(room.name, room.terminal.id);
			delete Memory.rooms[room.name].resources.terminal;
			Memory.rooms[room.name].resources.terminal = [{id: room.terminal.id, orders: []}];

		}
	}

};
viralUtil.rawMemory = () => {

	const numActive = _.size(RawMemory.segments);
	for (let i = 0; i < 100; i++) {
		if (!_.isUndefined(RawMemory.segments[i])) {
			console.log(`id: ${i} RawMemory.segments[i]: ${RawMemory.segments[i]}`);
		}

	}


};

viralUtil.getMyRooms = () => {
	console.log(`myRooms: ${myRooms.length}`);
	for (const room of myRooms) {
		console.log(`room: ${room.name}`);
	}
};

viralUtil.getAcceptedRooms = () => {
	console.log(`myRooms: ${acceptedRooms.length}`);
	for (const room of acceptedRooms) {
		console.log(`room: ${room.name}`);
	}
};

viralUtil.getStoreMinerals = (roomName, compound) => {
	global.logSystem(roomName, `resources: ${Game.rooms[roomName].storedMinerals(compound)}`);
};

viralUtil.getResourcesToAllocate = (roomName, compound) => {
	global.logSystem(roomName, `resources: ${Game.rooms[roomName].resourcesToAllocate(compound)}`);
};

viralUtil.getResourcesAll = (roomName, compound) => {
	global.logSystem(roomName, `resources: ${Game.rooms[roomName].resourcesAll[compound]}`);

};

viralUtil.getResourcesCreeps = (roomName, compound) => {
	console.log(`resourcesCreeps: ${global.json(Game.rooms[roomName].resourcesCreeps)}`);
	global.logSystem(roomName, `resources: ${Game.rooms[roomName].resourcesCreeps[compound]}`);

};

viralUtil.getResourcesOffers = (roomName, compound) => {
	console.log(`resourcesOffers: ${global.json(Game.rooms[roomName].resourcesOffers)}`);
	global.logSystem(roomName, `resources: ${Game.rooms[roomName].resourcesOffers[compound]}`);

};

viralUtil.getResourcesOrders = (roomName, compound) => {
	console.log(`resourcesOrders: ${global.json(Game.rooms[roomName].resourcesOrders)}`);
	global.logSystem(roomName, `resources: ${Game.rooms[roomName].resourcesOrders[compound]}`);

};

viralUtil.getResourcesReactions = (roomName, compound) => {
	console.log(`resourcesReactions: ${global.json(Game.rooms[roomName].resourcesReactions)}`);
	global.logSystem(roomName, `resources: ${Game.rooms[roomName].resourcesReactions[compound]}`);

};

viralUtil.checkTerminalOrders = (roomName) => {
	let data = Game.rooms[roomName].memory.resources;
	for (let order of data.terminal[0].orders) {
		global.BB(order);
		if (order.storeAmount === 0)
			order.storeAmount = 100;
	}

};

viralUtil.checkStorageOrders = () => {
	for (let room of acceptedRooms) {
		let data = room.memory.resources;
		for (let order of data.storage[0].orders) {
			if (order.type === 'G')
				console.log(`room: ${room.name}`);
		}
	}
};

viralUtil.checkTerminalOrdersType = () => {

	for (const room of acceptedRooms) {

		let data = room.memory.resources;
		for (let order of data.terminal[0].orders) {
			if (Array.isArray(order)) {
				// order = {};}
				console.log(`room: ${room.name}`);
			}
		}

	}
};


viralUtil.getResourcesAllButMe = (roomName, compound) => {
	global.logSystem(roomName, `resourcesAllButMe: ${Game.rooms[roomName].resourcesAllButMe(compound)}`);
};

viralUtil.checkCompoundThreshold = () => {
	for (const room of acceptedRooms) {
		for (const compound in Memory.compoundsToAllocate) {
			let compoundObject = Memory.compoundsToAllocate[compound];
			if (compoundObject.allocate) {
				if ((room.resourcesAll[compound] || 0) < Memory.compoundsToAllocate[compound].roomThreshold)
					global.logSystem(room.name, `${compound}: ${room.resourcesAll[compound] || 0}`);
			}

		}
	}
};


/*
Orders[
{id:, type:, amount:, offers[amount:, room:]}
]

Offers [
{id:, type:, amount:, room:}
]

reactions {
orders[id: type: mode: amount:], reactorType:, seed_a:, seed_b:, reactorMode:
}

candidates [
{room:, readyOffers:}
]


boostTiming {

reactionPlaced:
ordersPlaced:
reactionMaking:
checkRoomAt:
orderAttempt:
ordersReady = {
                time: Game.time,
                orderCandidates: [{room: offer.room, readyOffers: readyOffersFound}]
            };

}

terminal[
id:
orders[
{type: orderamount: orderRemaining: storeAmount:}
]
]
 */


module.exports = viralUtil;
