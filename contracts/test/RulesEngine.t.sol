// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RulesEngine} from "../src/lib/RulesEngine.sol";

contract RulesEngineTest is Test {
    function _parse(string memory s) internal pure returns (RulesEngine.Move memory mv, bool ok, string memory reason) {
        return RulesEngine.parse(s);
    }

    function testParsePass() public pure {
        (RulesEngine.Move memory mv, bool ok,) = _parse("PASS");
        assertTrue(ok);
        assertEq(uint256(mv.kind), uint256(RulesEngine.MoveKind.PASS));
    }

    function testParseOfferBuy() public pure {
        (RulesEngine.Move memory mv, bool ok,) = _parse("OFFER|lot=2|side=BUY|price=14");
        assertTrue(ok);
        assertEq(uint256(mv.kind), uint256(RulesEngine.MoveKind.OFFER));
        assertEq(uint256(mv.side), uint256(RulesEngine.Side.BUY));
        assertEq(mv.lot, 2);
        assertEq(mv.price, 14);
    }

    function testParseCounter() public pure {
        (RulesEngine.Move memory mv, bool ok,) = _parse("COUNTER|lot=1|price=9");
        assertTrue(ok);
        assertEq(uint256(mv.kind), uint256(RulesEngine.MoveKind.COUNTER));
        assertEq(mv.lot, 1);
        assertEq(mv.price, 9);
    }

    function testParseCoalition() public pure {
        (RulesEngine.Move memory mv, bool ok,) = _parse("COALITION|partner=3|share=50");
        assertTrue(ok);
        assertEq(uint256(mv.kind), uint256(RulesEngine.MoveKind.COALITION));
        assertEq(mv.partner, 3);
        assertEq(mv.share, 50);
    }

    function testParseWithQuotesAndWhitespace() public pure {
        (, bool ok,) = _parse("  \"OFFER|lot=1|side=BUY|price=5\"\n");
        assertTrue(ok);
    }

    function testRejectUnknownKind() public pure {
        (, bool ok, string memory r) = _parse("ATTACK|lot=1");
        assertFalse(ok);
        assertEq(r, "unknown kind");
    }

    function testRejectBadPrice() public pure {
        (, bool ok,) = _parse("OFFER|lot=1|side=BUY|price=abc");
        assertFalse(ok);
    }

    function testRejectMissingField() public pure {
        (, bool ok,) = _parse("OFFER|lot=1|side=BUY");
        assertFalse(ok);
    }

    function testRejectBadSide() public pure {
        (, bool ok,) = _parse("OFFER|lot=1|side=HOLD|price=5");
        assertFalse(ok);
    }
}
