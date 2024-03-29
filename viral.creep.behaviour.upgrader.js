"use strict";


let viralCreepBehaviourUpgrader = {};

viralCreepBehaviourUpgrader.selectStrategies = function (actionName) {
    return [viralCreepBehaviourUpgrader.strategies.defaultStrategy, viralCreepBehaviourUpgrader.strategies[actionName]];
};

viralCreepBehaviourUpgrader.strategies = {
    boosting: {
        isValidMineralType : function (mineralType) {
            for (const category in BOOSTS) {
                for (const compound in BOOSTS[category]) {
                    if (mineralType === compound) {
                        if (BOOSTS[category][compound].upgradeController) {
                            // console.log(compound);
                            return true;
                        }
                    }
                }
            }
            return false;
        }
    }
};

viralCreepBehaviourUpgrader.invalidCreep = c => ['miner', 'upgrader'].includes(c.data.creepType) && c.data.determinatedSpot &&
    (c.data.ttl > c.data.spawningTime || c.data.ttl > c.data.predictedRenewal);

viralCreepBehaviourUpgrader.run = function (creep) {

    if (creep.room.controller.upgradeBlocked && !creep.data.boosted) { // TODO boosting can happen in multiple passes!
        // TODO don't do this if you're boosted! T_T
        creep.data.creepType = 'recycler';
        return;
    }

    // boosting
    if (creep.ticksToLive > 1350 && creep.data && !creep.data.boosted) {

        let notBoostedParts = _.some(creep.body, bodyParts => {
            return bodyParts.type === 'work' && !bodyParts.boost;
        });

        if (!notBoostedParts)
            creep.data.boosted = true;

        let labs = creep.room.find(FIND_MY_STRUCTURES, {filter: (s)=> {
                return s.structureType === STRUCTURE_LAB && s.mineralType === RESOURCE_CATALYZED_GHODIUM_ACID &&
                    s.mineralAmount > LAB_BOOST_MINERAL && s.energy >= LAB_BOOST_ENERGY;
            }});
        if (labs.length === 0)
            labs = creep.room.find(FIND_MY_STRUCTURES, {filter: (s)=> {
                return s.structureType === STRUCTURE_LAB && s.mineralType === RESOURCE_GHODIUM_ACID &&
                    s.mineralAmount > LAB_BOOST_MINERAL && s.energy >= LAB_BOOST_ENERGY;
            }});
        if (labs.length === 0)
            labs = creep.room.find(FIND_MY_STRUCTURES, {filter: (s)=> {
                return s.structureType === STRUCTURE_LAB && s.mineralType === RESOURCE_GHODIUM_HYDRIDE &&
                    s.mineralAmount > LAB_BOOST_MINERAL && s.energy >= LAB_BOOST_ENERGY;
            }});

        if (labs.length > 0) {
            let lab = _.max(labs, 'mineralAmount');
            if (global.SAY_ASSIGNMENT) creep.say(String.fromCharCode(9883), global.SAY_PUBLIC);
            if (creep.pos.getRangeTo(lab) > 1)
                creep.moveTo(lab);
            else
                lab.boostCreep(creep);
            return;
        }
    }

    if (!creep.action || creep.action.name !== 'upgrading')
        Population.registerAction(creep, Creep.action.upgrading, creep.room.controller);
    if (!creep.data.determinatedSpot) {
        let determineSpots = (ignoreSources=false) => {
            let spots = [];
            let getSpots = s => {
                let args = {
                    spots: [{
                        pos: creep.room.controller.pos,
                        range: 3
                    },
                        {
                            pos: s.pos,
                            range: 1
                        }],
                    checkWalkable: true,
                    where: pos => !_.some(pos.lookFor(LOOK_CREEPS), viralCreepBehaviourUpgrader.invalidCreep) && (ignoreSources || pos.findInRange(creep.room.sources, 1).length === 0),
                    roomName: creep.pos.roomName
                };
                return Room.fieldsInRange(args);
            };
            let linkSpots = creep.room.structures.links.controller ? _.flatten(_.map(creep.room.structures.links.controller, getSpots)) : [];
            let containerSpots = creep.room.structures.container.controller ? _.flatten(_.map(creep.room.structures.container.controller, getSpots)) : [];
            let storageSpots = creep.room.storage ? getSpots(creep.room.storage) : [];
            let terminalSpots = creep.room.terminal ? getSpots(creep.room.terminal) : [];
            // priority = close to both link and a form of storage > close to link only > close to a form of storage only
            if (linkSpots.length) {
                let both = [];
                if (both.length === 0 && containerSpots.length) both = _.filter(linkSpots, l => _.some(containerSpots, c => c.isEqualTo(l)));
                if (both.length === 0 && storageSpots.length) both = _.filter(linkSpots, l => _.some(storageSpots, c => c.isEqualTo(l)));
                if (both.length === 0 && terminalSpots.length) both = _.filter(linkSpots, l => _.some(terminalSpots, c => c.isEqualTo(l)));
                return both.length ? both : linkSpots;
            }
            // priority: containers > storage > terminal
            return containerSpots.length ? containerSpots : (storageSpots.length ? storageSpots : terminalSpots);
        };
        let spots = determineSpots();
        // logSystem(creep.room.name, `spots: ${spots.length}`);
        if (spots.length > 0) {
            // allow spots near sources
            spots = determineSpots(true);
        }
        if (spots.length > 0) {
            // prefer off roads
            let spot = creep.pos.findClosestByPath(spots, {filter: pos => {
                    return !_.some(
                        creep.room.lookForAt(LOOK_STRUCTURES, pos),
                        {'structureType': STRUCTURE_ROAD }
                    );
                }});
            if (!spot) spot = creep.pos.findClosestByPath(spots) || spots[0];
            if (spot) {
                creep.data.determinatedSpot = {
                    x: spot.x,
                    y: spot.y
                };
                let spawn = Game.spawns[creep.data.motherSpawn];
                if (spawn) {
                    let path = spot.findPathTo(spawn, {ignoreCreeps: true});
                    const speed = creep.data.body ? Math.ceil(creep.data.body.work / (2 * creep.data.body.move)) : 1; // road assumed
                    if (path) creep.data.predictedRenewal = creep.data.spawningTime + (path.length * speed);
                }
            }
        }
        if (!creep.data.determinatedSpot) {
            logError('Unable to determine working location for upgrader in room ' + creep.pos.roomName);
            /*
            creep.travelTo(creep.room.controller);
            if (creep.pos.getRangeTo(creep.room.controller) <= 3)
                creep.data.determinatedSpot = {
                    x: creep.pos.x,
                    y: creep.pos.y
                };
*/
        } else if (global.SAY_ASSIGNMENT) creep.say(String.fromCharCode(9962), global.SAY_PUBLIC);
    }

    if (creep.data.determinatedSpot) {

        creep.controllerSign();

        if (global.CHATTY) creep.say('upgrading', global.SAY_PUBLIC);
        let range = this.approach(creep);
        if (creep.room.controller && creep.pos.getRangeTo(creep.room.controller) <= 3) {
            let carryThreshold = (creep.data.body && creep.data.body.work ? creep.data.body.work : (creep.carryCapacity / 2));

            if (creep.carry.energy <= carryThreshold) {
                let store = _.find(creep.room.structures.links.controller, s => s.energy > 0 && creep.pos.isNearTo(s));
                if (!store) store = _.find(creep.room.structures.container.controller, s => s.store[RESOURCE_ENERGY] > 0 && creep.pos.isNearTo(s));
                if (!store) {
                    store = creep.room.storage && creep.room.storage.charge > 0 &&
                        creep.pos.isNearTo(creep.room.storage);
                }
                if (!store) {
                    store = creep.room.terminal && creep.room.terminal.store[RESOURCE_ENERGY] > 0.5 * TERMINAL_ENERGY && creep.pos.isNearTo(creep.room.terminal);
                }
                if (store) creep.withdraw(store, RESOURCE_ENERGY);
            }

            creep.controllerSign();
            creep.upgradeController(creep.room.controller);
        }
    }
};

module.exports = viralCreepBehaviourUpgrader;







