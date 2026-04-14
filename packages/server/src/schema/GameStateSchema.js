var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Schema, type, MapSchema } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";
export class GameStateSchema extends Schema {
    phase = "lobby";
    publicData = "{}";
    roomCode = "";
    players = new MapSchema();
}
__decorate([
    type("string"),
    __metadata("design:type", String)
], GameStateSchema.prototype, "phase", void 0);
__decorate([
    type("string"),
    __metadata("design:type", String)
], GameStateSchema.prototype, "publicData", void 0);
__decorate([
    type("string"),
    __metadata("design:type", String)
], GameStateSchema.prototype, "roomCode", void 0);
__decorate([
    type({ map: PlayerSchema }),
    __metadata("design:type", Object)
], GameStateSchema.prototype, "players", void 0);
//# sourceMappingURL=GameStateSchema.js.map