// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RulesEngine
/// @notice Parses Bazaar negotiation moves from LLM-emitted strings into structured form.
/// Validation against game state happens in `Arena._applyMove`; this library only
/// converts text → struct and rejects malformed input.
///
/// Grammar (one move per LLM response):
///   PASS
///   OFFER|lot=<uint>|side=BUY|price=<uint>
///   OFFER|lot=<uint>|side=SELL|price=<uint>
///   COUNTER|lot=<uint>|price=<uint>
///   COALITION|partner=<uint>|share=<uint>
///
/// Tolerated noise: surrounding whitespace, optional surrounding quotes ("..." or '...'),
/// trailing newline.
library RulesEngine {
    enum MoveKind { PASS, OFFER, COUNTER, COALITION, INVALID }
    enum Side { NONE, BUY, SELL }

    struct Move {
        MoveKind kind;
        Side     side;
        uint256  lot;
        uint256  price;
        uint256  partner;
        uint256  share;
    }

    function parse(string memory raw) internal pure returns (Move memory mv, bool ok, string memory reason) {
        bytes memory b = bytes(raw);
        // strip whitespace + optional wrapping quotes
        (uint256 s, uint256 e) = _trim(b);
        if (s == e) return (mv, false, "empty");

        // first segment: kind, ends at '|' or end
        uint256 segEnd = _findChar(b, s, e, "|");
        bytes32 head = _slice32(b, s, segEnd);

        if (head == _h("PASS") || head == _h("pass")) {
            // accept PASS even if there's trailing garbage
            mv.kind = MoveKind.PASS;
            return (mv, true, "");
        }
        if (head == _h("OFFER") || head == _h("offer")) {
            mv.kind = MoveKind.OFFER;
            return _parseOffer(b, segEnd, e, mv);
        }
        if (head == _h("COUNTER") || head == _h("counter")) {
            mv.kind = MoveKind.COUNTER;
            return _parseCounter(b, segEnd, e, mv);
        }
        if (head == _h("COALITION") || head == _h("coalition")) {
            mv.kind = MoveKind.COALITION;
            return _parseCoalition(b, segEnd, e, mv);
        }
        return (mv, false, "unknown kind");
    }

    function _parseOffer(bytes memory b, uint256 from, uint256 end, Move memory mv)
        private pure returns (Move memory, bool, string memory)
    {
        bool gotLot; bool gotSide; bool gotPrice;
        uint256 p = from;
        while (p < end) {
            // skip '|'
            while (p < end && b[p] == "|") p++;
            uint256 kvEnd = _findChar(b, p, end, "|");
            (bytes32 k, bytes32 v, uint256 vnum, bool vIsNum) = _kv(b, p, kvEnd);
            if (k == _h("lot")) {
                if (!vIsNum) return (mv, false, "lot not int");
                mv.lot = vnum; gotLot = true;
            } else if (k == _h("side")) {
                if (v == _h("BUY") || v == _h("buy")) mv.side = Side.BUY;
                else if (v == _h("SELL") || v == _h("sell")) mv.side = Side.SELL;
                else return (mv, false, "bad side");
                gotSide = true;
            } else if (k == _h("price")) {
                if (!vIsNum) return (mv, false, "price not int");
                mv.price = vnum; gotPrice = true;
            } else {
                return (mv, false, "unknown OFFER field");
            }
            p = kvEnd;
        }
        if (!gotLot || !gotSide || !gotPrice) return (mv, false, "OFFER missing fields");
        return (mv, true, "");
    }

    function _parseCounter(bytes memory b, uint256 from, uint256 end, Move memory mv)
        private pure returns (Move memory, bool, string memory)
    {
        bool gotLot; bool gotPrice;
        uint256 p = from;
        while (p < end) {
            while (p < end && b[p] == "|") p++;
            uint256 kvEnd = _findChar(b, p, end, "|");
            (bytes32 k, , uint256 vnum, bool vIsNum) = _kv(b, p, kvEnd);
            if (k == _h("lot")) {
                if (!vIsNum) return (mv, false, "lot not int");
                mv.lot = vnum; gotLot = true;
            } else if (k == _h("price")) {
                if (!vIsNum) return (mv, false, "price not int");
                mv.price = vnum; gotPrice = true;
            } else {
                return (mv, false, "unknown COUNTER field");
            }
            p = kvEnd;
        }
        if (!gotLot || !gotPrice) return (mv, false, "COUNTER missing fields");
        return (mv, true, "");
    }

    function _parseCoalition(bytes memory b, uint256 from, uint256 end, Move memory mv)
        private pure returns (Move memory, bool, string memory)
    {
        bool gotPartner;
        uint256 p = from;
        while (p < end) {
            while (p < end && b[p] == "|") p++;
            uint256 kvEnd = _findChar(b, p, end, "|");
            (bytes32 k, , uint256 vnum, bool vIsNum) = _kv(b, p, kvEnd);
            if (k == _h("partner")) {
                if (!vIsNum) return (mv, false, "partner not int");
                mv.partner = vnum; gotPartner = true;
            } else if (k == _h("share")) {
                if (!vIsNum) return (mv, false, "share not int");
                mv.share = vnum;
            } else {
                return (mv, false, "unknown COALITION field");
            }
            p = kvEnd;
        }
        if (!gotPartner) return (mv, false, "COALITION missing partner");
        return (mv, true, "");
    }

    // --- low-level helpers ----------------------------------------------------------------

    function _trim(bytes memory b) private pure returns (uint256 s, uint256 e) {
        s = 0; e = b.length;
        // strip leading ws + opening quote
        while (s < e && _isWs(b[s])) s++;
        if (s < e && (b[s] == '"' || b[s] == "'")) s++;
        // strip trailing ws + closing quote
        while (e > s && _isWs(b[e-1])) e--;
        if (e > s && (b[e-1] == '"' || b[e-1] == "'")) e--;
        while (e > s && _isWs(b[e-1])) e--;
    }
    function _isWs(bytes1 c) private pure returns (bool) {
        return c == 0x20 || c == 0x09 || c == 0x0a || c == 0x0d;
    }
    function _findChar(bytes memory b, uint256 from, uint256 end, bytes1 needle) private pure returns (uint256) {
        for (uint256 i = from; i < end; i++) if (b[i] == needle) return i;
        return end;
    }

    function _kv(bytes memory b, uint256 from, uint256 end)
        private pure returns (bytes32 key, bytes32 val, uint256 vnum, bool vIsNum)
    {
        uint256 eqPos = _findChar(b, from, end, "=");
        if (eqPos == end) return (bytes32(0), bytes32(0), 0, false);
        key = _slice32(b, from, eqPos);
        val = _slice32(b, eqPos + 1, end);
        (vnum, vIsNum) = _toUint(b, eqPos + 1, end);
    }

    function _slice32(bytes memory b, uint256 from, uint256 end) private pure returns (bytes32 out) {
        uint256 n = end - from;
        if (n > 32) n = 32;
        for (uint256 i = 0; i < n; i++) {
            out |= bytes32(b[from + i]) >> (i * 8);
        }
    }

    function _toUint(bytes memory b, uint256 from, uint256 end) private pure returns (uint256 v, bool ok) {
        if (from >= end) return (0, false);
        for (uint256 i = from; i < end; i++) {
            bytes1 c = b[i];
            if (c < 0x30 || c > 0x39) return (0, false);
            v = v * 10 + (uint8(c) - 48);
        }
        return (v, true);
    }

    /// Encode a short ASCII identifier into the same shape as `_slice32` for comparison.
    function _h(string memory s) private pure returns (bytes32 out) {
        bytes memory b = bytes(s);
        uint256 n = b.length;
        if (n > 32) n = 32;
        for (uint256 i = 0; i < n; i++) {
            out |= bytes32(b[i]) >> (i * 8);
        }
    }
}
